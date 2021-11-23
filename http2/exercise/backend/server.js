import http2 from "http2";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import handler from "serve-handler";
import EventEmitter from "events";

const messages = [];

// the two commands you'll have to run in the root directory of the project are
// (not inside the backend folder)
//
// openssl req -new -newkey rsa:2048 -new -nodes -keyout key.pem -out csr.pem
// openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out server.crt
//
// http2 only works over HTTPS
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const server = http2.createSecureServer({
  cert: fs.readFileSync(path.join(__dirname, "/../server.crt")),
  key: fs.readFileSync(path.join(__dirname, "/../key.pem")),
});

const newMessages = new EventEmitter();

server.on("request", async (req, res) => {
  const url = new URL(req.headers[":path"], "https://example.com");
  const method = req.headers[":method"];

  if (url.pathname !== "/msgs") {
    // handle the static assets
    return handler(req, res, {
      public: "./frontend",
    });
  } else if (method === "POST") {
    // get data out of post
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }

    const data = Buffer.concat(buffers).toString();
    const { user, text } = JSON.parse(data);
    const message = { user, text, time: Date.now() };

    res.end();

    messages.push(message);
    newMessages.emit("message", message);
  }
});

server.on("stream", (stream, headers) => {
  const url = new URL(headers[":path"], "https://example.com");
  const method = headers[":method"];

  if (url.pathname !== "/msgs" || method !== "GET") {
    console.log(pathname + " not messages, exit...");
    return;
  }

  stream.respond({
    ":status": 200,
    "content-type": "text/plain; charset=utf-8",
  });

  const lastSeen = parseInt(url.searchParams.get("time"));

  let i = messages.length - 1;
  for (; i >= 0; i--) {
    if (messages[i].time === lastSeen) {
      break;
    }
  }

  if (i !== messages.length - 1) {
    stream.write(JSON.stringify(messages.slice(i + 1)));
  }

  const newMessagesHandler = (m) => stream.write(JSON.stringify([m]));

  newMessages.on("message", newMessagesHandler);
  stream.on("close", () => newMessages.off("message", newMessagesHandler));
});

// start listening
const port = process.env.PORT || 8080;
server.listen(port, () =>
  console.log(
    `Server running at https://localhost:${port} - make sure you're on httpS, not http`
  )
);
