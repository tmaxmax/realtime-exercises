import express from "express";
import morgan from "morgan";
import EventEmitter from "events";

const messages = [];

// get express ready to run
const app = express();
app.use(morgan("dev"));
app.use(express.json());
app.use(express.static("frontend"));

const ev = new EventEmitter();

app.get("/poll", function (req, res) {
  const lastMessageTime = parseInt(req.query.time);
  let index = messages.length - 1;
  for (; index >= 0; index--) {
    if (messages[index].time == lastMessageTime) {
      break;
    }
  }

  if (index == messages.length - 1) {
    ev.once("message", (m) => res.json([m]));
  } else {
    res.json(messages.slice(index + 1));
  }
});

app.post("/poll", function (req, res) {
  const { user, text } = req.body;
  const message = { user, text, time: Date.now() };
  messages.push(message);
  ev.emit("message", message);
  res.status(204).send();
});

// start the server
const port = process.env.PORT || 3000;
app.listen(port);
console.log(`listening on http://localhost:${port}`);
