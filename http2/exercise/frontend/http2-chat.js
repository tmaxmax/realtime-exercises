const chat = document.getElementById("chat");
const msgs = document.getElementById("msgs");
const presence = document.getElementById("presence-indicator");

// this will hold all the most recent messages
let allChat = [];
let lastSeen = 0;

chat.addEventListener("submit", function (e) {
  e.preventDefault();
  postNewMsg(chat.elements.user.value, chat.elements.text.value);
  chat.elements.text.value = "";
});

async function postNewMsg(user, text) {
  const data = {
    user,
    text,
  };

  // request options
  const options = {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  };

  // send POST request
  // we're not sending any json back, but we could
  await fetch("/msgs", options);
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function getNewMsgs(initialBackoff = 2000, maxBackoff = 16000) {
  for (let backoff = initialBackoff; backoff < maxBackoff; backoff *= 2) {
    try {
      presence.innerText = "🟡";

      const res = await fetch(`/msgs?time=${lastSeen}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      presence.innerText = "🟢";

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          break;
        }

        backoff = initialBackoff;

        const data = JSON.parse(decoder.decode(chunk.value, { stream: true }));
        lastSeen = data[data.length - 1].time;
        allChat.push(...data);

        for (const message of data) {
          msgs.prepend(template(message));
        }
      }

      break;
    } catch (err) {
      presence.innerText = "🔴";

      if (err instanceof TypeError) {
        console.error("Failed to receive messages:", err);
        console.log(`Retrying in ${backoff}ms...`);
        await sleep(backoff);
      } else {
        console.error("Unexpected error:", err);
        break;
      }
    }
  }

  presence.innerText = "⚫";
}

const template = ({ user, text }) => {
  const li = document.createElement("li");
  li.classList.add("collection-item");

  const span = document.createElement("span");
  span.classList.add("badge");
  span.appendChild(document.createTextNode(user));

  li.appendChild(span);
  li.appendChild(document.createTextNode(text));

  return li;
};

getNewMsgs();
