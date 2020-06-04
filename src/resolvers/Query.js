require("dotenv").config();
const { getUserId } = require("./../utils");
const moment = require("moment");

function accounts(_, args, ctx, info) {
  const userId = getUserId(ctx);
  return ctx.db.query.accounts(
    {
      where: {
        OR: [
          {
            user: {
              id: userId,
            },
          },
          {
            user: null,
          },
        ],
      },
      orderBy: "description_ASC",
    },
    info
  );
}

function categories(_, { operation }, ctx, info) {
  const userId = getUserId(ctx);

  let AND = [
    {
      OR: [{ user: { id: userId } }, { user: null }],
    },
  ];

  AND = !operation ? AND : [...AND, { operation }];

  return ctx.db.query.categories(
    {
      where: { AND },
      orderBy: "description_ASC",
    },
    info
  );
}

async function records(
  _,
  { month, type, accountsIds, categoriesIds },
  ctx,
  info
) {
  const userId = getUserId(ctx);

  let AND = [{ user: { id: userId } }];

  AND = !type ? AND : [...AND, { type }];

  AND =
    !accountsIds || accountsIds.length === 0
      ? AND
      : [...AND, { OR: accountsIds.map((id) => ({ account: { id } })) }];

  AND =
    !categoriesIds || categoriesIds.length === 0
      ? AND
      : [...AND, { OR: categoriesIds.map((id) => ({ category: { id } })) }];

  if (month) {
    const date = moment(month, "MM-YYYY");
    const startDate = date.startOf("month").toISOString();
    const endDate = date.endOf("month").toISOString();
    AND = [...AND, { date_gte: startDate }, { date_lte: endDate }];

    console.log("Base Date: ", date.toISOString());
    console.log("Start Date: ", startDate);
    console.log("End Date: ", endDate);
  }

  return ctx.db.query.records(
    {
      where: { AND },
      orderBy: "date_ASC",
    },
    info
  );
}

function user(_, args, ctx, info) {
  const userId = getUserId(ctx);
  return ctx.db.query.user({ where: { id: userId } }, info);
}

async function totalBalance(_, { date }, ctx, info) {
  const userId = getUserId(ctx);
  const dateISO = moment(date, "YYYY-MM-DD")
    .endOf("day")
    .toISOString();
  const pgSchema = `${process.env.PRISMA_SERVICE}$${process.env.PRISMA_STAGE}`;
  const mutation = `
    mutation TotalBalance($dataBase: PrismaDatabase, $query: String!) { 
      executeRaw(database: $dataBase, query: $query)
    }
  `;
  const variables = {
    dataBase: "default",
    query: `
      SELECT SUM("${pgSchema}"."Record"."amount") as totalBalance
       FROM "${pgSchema}"."Record"

      INNER JOIN "${pgSchema}"."_RecordToUser"
      ON "${pgSchema}"."_RecordToUser"."A" = "${pgSchema}"."Record"."id"

      WHERE "${pgSchema}"."_RecordToUser"."B" = '${userId}'

      AND "${pgSchema}"."Record"."date" <= '${dateISO}'
    `,
  };

  return ctx.prisma.$graphql(mutation, variables).then((response) => {
    console.log("Response: ", response);
    const totalBalance = response.executeRaw[0].totalbalance;
    return totalBalance ? totalBalance : 0;
  });
}

module.exports = {
  accounts,
  categories,
  records,
  user,
  totalBalance,
};
