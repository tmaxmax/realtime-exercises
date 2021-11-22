const chat = document.getElementById("chat");
const msgs = document.getElementById("msgs");

// let's store all current messages here
let allChat = [];

// the interval to poll at in milliseconds
const INTERVAL = 3000;

// a submit listener on the form in the HTML
chat.addEventListener("submit", function (e) {
  e.preventDefault();
  postNewMsg(chat.elements.user.value, chat.elements.text.value);
  chat.elements.text.value = "";
});

function postNewMsg(user, text) {
  return fetch("/poll", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user, text }),
  });
}

let lastMessageTime = 0;

function getNewMsgs() {
  return fetch(`/poll?time=${lastMessageTime}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then((res) => {
      allChat = res.reverse().concat(allChat);
      lastMessageTime = allChat[0].time;
      render();
    });
}

function render() {
  // as long as allChat is holding all current messages, this will render them
  // into the ui. yes, it's inefficent. yes, it's fine for this example
  const html = allChat.map(({ user, text, time, id }) =>
    template(user, text, time, id)
  );
  msgs.innerHTML = html.join("\n");
}

// given a user and a msg, it returns an HTML string to render to the UI
const template = (user, msg) =>
  `<li class="collection-item"><span class="badge">${user}</span>${msg}</li>`;

/**
 * @param {() => Promise<unknown>} fn
 * @param {{ interval?: number, retries?: number, backoff?: number }} param1
 */
function poll(fn, { interval, retries, backoff }) {
  retries ||= 3;
  backoff ||= interval;

  let nextPoll = 0;
  let currentRetry = 0;
  let handle;
  let lastErr;
  let resolve, reject;

  const p = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const pollFn = (time) => {
    if (nextPoll > time) {
      handle = requestAnimationFrame(pollFn);
      return;
    }

    try {
      fn()
        .then(() => {
          currentRetry = 0;
          lastErr = undefined;
          return false;
        })
        .catch((err) => {
          lastErr = err;
          currentRetry++;
          if (currentRetry == retries) {
            reject(err);
          } else {
            return true;
          }
        })
        .then((isError) => {
          if (typeof isError === "undefined") {
            return;
          }

          const duration = performance.now() - time;
          nextPoll =
            time +
            duration +
            (isError ? backoff * (currentRetry + 1) : interval);
          handle = requestAnimationFrame(pollFn);
        });
    } catch (err) {
      lastErr = err;
      reject(err);
    }
  };

  return {
    start() {
      handle = requestAnimationFrame(pollFn);
      return p;
    },
    stop() {
      if (!handle) {
        return;
      }

      cancelAnimationFrame(handle);

      if (lastErr) {
        reject(lastErr);
      } else {
        resolve();
      }
    },
  };
}

poll(getNewMsgs, { backoff: 3000 }).start().catch(console.error);
