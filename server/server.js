import "./instruments.js";

// import { Sentry } from "@sentry/node";

import express from "express";
import dotenv from "dotenv";
import { fetchTokenWithAccessCode } from "./helper.js";
import cors from "cors";
import path from "path";

// configurations
dotenv.config();

// Boot express
const app = express();
const port = process.env.PORT || 3000;

// Application routes
// const makeIndex = require("../pages/index.html.js");
// const makeOAuthCallback = require("../pages/oauth-callback.html.js");
// app.get("/", (req, res) => {
//   res.send(makeIndex(req, "./dist/hosted-main.min.js", { showHeader: true }));
// });

// app.get("/dev", (req, res) => {
//   res.send(makeIndex(req, "./dist/hosted-main.js", { showHeader: true }));
// });

// // Atlassian Connect specific endpoints
// app.get("/connect", (req, res) => {
//   res.send(makeIndex(req, "./dist/connect-main.min.js", { showHeader: false }));
// });

// app.get("/oauth-callback", (req, res) => {
//   res.send(makeOAuthCallback(req));
// });

app.use(cors());

app.get("/access-token", async (req, res) => {
  try {
    const code = req.query.code;
    const refresh = req.query.refresh;
    let data = {};
    if (!code) throw new Error("No Access code provided");
    const { error, data: accessData, message } = await fetchTokenWithAccessCode(code, refresh);
    if (error) {
      //handle properly
      return res.status(400).json({
        error: true,
        message,
      });
    } else {
      data = accessData;
    }
    return res.json({
      error: false,
      ...data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      message: `${error.message}`,
    });
  }
});

// Sentry setup needs to be done before the middlewares
// Sentry.setupExpressErrorHandler(app);

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(express.static(path.join(__dirname, "..", "public")));

app.use(function onError(err, req, res, next) {
  // Todo: do we want a page for this?
  res.statusCode = 500;
  res.end(res.sentry + "\n");
});

// Start server
app.listen(port, () => console.log(`Server is listening on port ${port}!`));

// Handle unhandled promise rejections and exceptions
// process.on("unhandledRejection", (err) => {
//   console.log(err);
//   Sentry.captureException(err);
// });

// process.on("uncaughtException", (err) => {
//   console.log(err.message);
//   Sentry.captureException(err);
// });
