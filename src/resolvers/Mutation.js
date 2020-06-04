require("dotenv").config();
const { getUserId } = require("./../utils");
const moment = require("moment");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

async function createAccount(_, { description }, ctx, info) {
  const userId = getUserId(ctx);
  return ctx.db.mutation.createAccount(
    {
      data: {
        description,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    },
    info
  );
}

async function createCategory(_, { description, operation }, ctx, info) {
  const userId = getUserId(ctx);
  return ctx.db.mutation.createCategory(
    {
      data: {
        description,
        operation,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    },
    info
  );
}

async function createRecord(_, args, ctx, info) {
  const date = moment(args.date);

  if (!date.isValid()) {
    throw new Error("Data inválida.");
  }

  let { amount, type } = args;
  if (
    (type === "DEBIT" && amount > 0) || // +50 => -50
    (type === "CREDIT" && amount < 0) // -50 => +50
  ) {
    amount = -amount;
  }

  const userId = getUserId(ctx);
  return ctx.db.mutation.createRecord(
    {
      data: {
        user: {
          connect: {
            id: userId,
          },
        },
        account: {
          connect: {
            id: args.accountId,
          },
        },
        category: {
          connect: {
            id: args.categoryId,
          },
        },
        amount,
        type,
        date: args.date,
        description: args.description,
        note: args.note,
        tags: args.tags,
      },
    },
    info
  );
}

async function login(_, { email, password }, ctx, info) {
  const user = await ctx.db.query.user({ where: { email } });
  if (!user) {
    throw new Error("Credenciais inválidas.");
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new Error("Credenciais inválidas.");
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: "2h",
  });

  console.log("User: ", user);
  console.log("Token: ", token);

  return {
    token,
    user,
  };
}

async function signup(_, args, ctx, info) {
  const password = await bcrypt.hash(args.password, 10);
  const user = await ctx.db.mutation.createUser({
    data: { ...args, password },
  });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
    expiresIn: "2h",
  });

  console.log("Password: ", password);

  return {
    token,
    user,
  };
}

module.exports = {
  createAccount,
  createCategory,
  createRecord,
  login,
  signup,
};
