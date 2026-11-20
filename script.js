// ---------- Setup ----------
const MY_ID = Math.random().toString(36).slice(2, 10);
const app = document.getElementById("app");
const config = window.GAME_CONFIG || {};
const configured =
	window.supabase &&
	config.supabaseUrl &&
	config.supabaseAnonKey &&
	!config.supabaseUrl.startsWith("YOUR_");
const client = configured
	? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
	: null;

let channel = null;
let chatLog = [];
const me = { nick: "", code: "" };
let round;

function resetRound() {
	round = {
		thinkerId: null,
		mine: false,
		thinkerNick: "",
		hint: "",
		secret: "",
		over: true,
		wrongGuesses: 0,
	};
}
resetRound();

// ---------- Helpers ----------
function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function normalize(text) {
	return String(text)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]/gu, "");
}

function clip(text, max) {
	return String(text == null ? "" : text).slice(0, max);
}

// ---------- Network (Supabase Realtime Broadcast) ----------
function emit(event, data) {
	return channel
		.send({ type: "broadcast", event, payload: { id: MY_ID, data } })
		.catch(() => addSystemLine("Message not sent. Check your connection."));
}

function playerCount() {
	return Object.keys(channel.presenceState()).length;
}

function updatePlayerCount() {
	const label = document.getElementById("cnt");
	if (label && channel) label.textContent = playerCount() + " here";
}

async function joinRoom(code) {
	channel = client.channel("guess-" + code, {
		config: { broadcast: { self: true }, presence: { key: MY_ID } },
	});

	channel.on("broadcast", { event: "chat" }, ({ payload }) => onChat(payload));
	channel.on("broadcast", { event: "ctl" }, ({ payload }) => onControl(payload));
	channel.on("presence", { event: "sync" }, updatePlayerCount);
	channel.on("presence", { event: "join" }, ({ key }) => {
		// Late joiners missed the round start, so the thinker announces it again.
		if (key !== MY_ID && round.mine && !round.over) {
			emit("ctl", { t: "start", nick: me.nick, hint: round.hint });
		}
	});

	await new Promise((resolve, reject) => {
		channel.subscribe((status) => {
			if (status === "SUBSCRIBED") resolve();
			if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
				reject(new Error(status));
			}
		});
	});
	await channel.track({ nick: me.nick });
}

function leaveRoom() {
	if (client && channel) client.removeChannel(channel);
	channel = null;
	resetRound();
}

// ---------- Lobby ----------
function showLobby(message) {
	app.innerHTML = "";
	app.appendChild(el("span", "tag", "Online · 2 or more players"));
	app.appendChild(el("h1", 0, "Who’s on your mind?"));
	app.appendChild(
		el(
			"p",
			0,
			"One player secretly writes down a person. Everyone else asks questions in the chat and tries to guess who it is.",
		),
	);

	const nickLabel = el("label", 0, "Nickname");
	const nickInput = el("input");
	nickInput.id = nickLabel.htmlFor = "nick";
	nickInput.placeholder = "Your nickname";
	nickInput.maxLength = 20;
	nickInput.value = me.nick;

	const codeLabel = el("label", 0, "Room code");
	const codeInput = el("input");
	codeInput.id = codeLabel.htmlFor = "code";
	codeInput.placeholder = "Room code (e.g. blue-fox)";
	codeInput.maxLength = 24;
	codeInput.value = me.code;

	app.append(nickLabel, nickInput, codeLabel, codeInput);

	const buttons = el("div", "row");
	buttons.style.marginTop = "14px";
	const joinButton = el("button", "btn", "Join room");
	const newCodeButton = el("button", "btn alt", "Make a new code");
	buttons.append(joinButton, newCodeButton);
	app.appendChild(buttons);

	const note = el(
		"p",
		message || !configured ? "err" : "",
		message ||
			(configured
				? "Send your friend the room code and the page link."
				: "Add your Supabase URL and key to config.js to play online."),
	);
	note.style.marginTop = "14px";
	app.appendChild(note);

	newCodeButton.onclick = () => {
		const colors = ["blue", "red", "gold", "mint", "plum", "teal"];
		const animals = ["fox", "owl", "pear", "lion", "moth", "crab"];
		const pick = (list) => list[Math.floor(Math.random() * list.length)];
		codeInput.value =
			pick(colors) + "-" + pick(animals) + "-" + (10 + Math.floor(Math.random() * 90));
	};

	joinButton.onclick = async () => {
		me.nick = clip(nickInput.value.trim(), 20);
		me.code = codeInput.value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "-");
		if (!me.nick || !me.code) return showLobby("Enter a nickname and a room code.");
		if (!configured) return showLobby("Online play is not set up yet. See README.md.");
		joinButton.disabled = true;
		try {
			await joinRoom(me.code);
		} catch (error) {
			leaveRoom();
			return showLobby("Could not open the room. Check your connection and try again.");
		}
		chatLog = [];
		resetRound();
		showRoom();
		addSystemLine("You joined room “" + me.code + "”.");
	};
}

// ---------- Chat lines ----------
function addSystemLine(text, kind) {
	const line = { nick: "", text, kind: kind || "sys" };
	chatLog.push(line);
	drawLine(line);
}

function drawLine(line) {
	const box = document.getElementById("chat");
	if (!box) return;
	let className = "m";
	if (line.kind === "sys") className += " sys";
	else if (line.kind === "ok") className += " ok";
	else {
		if (line.mine) className += " me";
		if (line.kind === "answer") className += " ans";
	}
	const bubble = el("div", className);
	if (line.nick && line.kind !== "sys" && line.kind !== "ok") {
		bubble.appendChild(el("small", 0, line.mine ? "You" : line.nick));
	}
	bubble.appendChild(document.createTextNode(line.text));
	box.appendChild(bubble);
	box.scrollTop = box.scrollHeight;
}

function sendChat(kind, text) {
	const clean = clip(text.trim(), 300);
	if (clean) emit("chat", { nick: me.nick, text: clean, kind });
}

function onChat(payload) {
	const data = payload.data || {};
	const line = {
		nick: clip(data.nick, 20),
		text: clip(data.text, 300),
		kind: data.kind === "answer" ? "answer" : "chat",
		mine: payload.id === MY_ID,
	};
	chatLog.push(line);
	drawLine(line);
}

// ---------- Game rules ----------
function onControl(payload) {
	const data = payload.data || {};
	const fromId = payload.id;
	const fromMe = fromId === MY_ID;

	if (data.t === "start") {
		if (round.thinkerId && round.thinkerId !== fromId && !round.over) return;
		const isNewRound = round.over || round.thinkerId !== fromId;
		round.thinkerId = fromId;
		round.mine = fromMe;
		round.thinkerNick = clip(data.nick, 20);
		round.hint = clip(data.hint, 80);
		round.over = false;
		round.wrongGuesses = 0;
		if (isNewRound) {
			addSystemLine(
				(fromMe ? "You are" : round.thinkerNick + " is") +
					" thinking of someone." +
					(round.hint ? " Hint: " + round.hint : ""),
			);
		}
		renderStatus();
	} else if (data.t === "guess") {
		addSystemLine(
			(fromMe ? "You" : clip(data.nick, 20)) + " guessed: " + clip(data.guess, 60),
		);
		if (round.mine && !round.over) {
			const correct = round.secret
				.split("/")
				.some((name) => normalize(name) && normalize(name) === normalize(data.guess));
			emit("ctl", {
				t: "result",
				ok: correct,
				guesser: clip(data.nick, 20),
				guess: clip(data.guess, 60),
				secret: correct ? round.secret : null,
			});
		}
	} else if (data.t === "result" && fromId === round.thinkerId && !round.over) {
		if (data.ok) {
			round.over = true;
			addSystemLine(
				"🎉 " + clip(data.guesser, 20) + " got it! It was " + clip(data.secret, 80) + ".",
				"ok",
			);
		} else {
			round.wrongGuesses++;
			addSystemLine(
				"Not " + clip(data.guess, 60) + ". Wrong guesses: " + round.wrongGuesses,
			);
		}
		renderStatus();
	} else if (data.t === "reveal" && fromId === round.thinkerId && !round.over) {
		round.over = true;
		addSystemLine("Round over. It was " + clip(data.secret, 80) + ".", "ok");
		renderStatus();
	}
}

// ---------- Room screen ----------
function showRoom() {
	app.innerHTML = "";

	const top = el("div", "row");
	top.style.justifyContent = "space-between";
	const count = el("span", 0, "");
	count.id = "cnt";
	count.style.color = "var(--muted)";
	const leave = el("button", "btn alt", "Leave");
	leave.onclick = () => {
		leaveRoom();
		showLobby();
	};
	top.append(el("span", "tag", "Room " + me.code), count, leave);
	app.appendChild(top);

	const status = el("div", "panel");
	status.id = "st";
	app.appendChild(status);

	const chat = el("div");
	chat.id = "chat";
	chat.setAttribute("aria-live", "polite");
	app.appendChild(chat);

	const row = el("div", "row send");
	const input = el("input");
	input.id = "msg";
	input.placeholder = "Type a question or a guess";
	input.maxLength = 300;
	const sendButton = el("button", "btn alt", "Send");
	const guessButton = el("button", "btn", "Guess");
	guessButton.id = "gs";
	row.append(input, sendButton, guessButton);
	app.appendChild(row);

	sendButton.onclick = () => {
		sendChat("chat", input.value);
		input.value = "";
		input.focus();
	};
	guessButton.onclick = () => {
		const guess = clip(input.value.trim(), 60);
		if (!guess) return;
		emit("ctl", { t: "guess", nick: me.nick, guess });
		input.value = "";
	};
	input.onkeydown = (event) => {
		if (event.key === "Enter") sendButton.onclick();
	};

	updatePlayerCount();
	renderStatus();
}

function renderStatus() {
	const panel = document.getElementById("st");
	if (!panel) return;
	panel.innerHTML = "";

	const guessButton = document.getElementById("gs");
	if (guessButton) guessButton.disabled = round.over || round.mine;

	if (round.over) {
		panel.appendChild(el("h2", 0, "Think of someone"));
		panel.appendChild(
			el(
				"p",
				0,
				"Write the person only you know. Add “/” for other accepted spellings, like Messi / Lionel Messi. Nobody else sees it until the round ends.",
			),
		);
		const secretInput = el("input");
		secretInput.placeholder = "Your secret person";
		secretInput.maxLength = 80;
		secretInput.setAttribute("aria-label", "Secret person");
		const hintInput = el("input");
		hintInput.placeholder = "Hint for others, e.g. a footballer";
		hintInput.maxLength = 80;
		hintInput.style.marginTop = "8px";
		hintInput.setAttribute("aria-label", "Hint");
		const startButton = el("button", "btn", "Start round");
		startButton.style.marginTop = "10px";
		startButton.onclick = () => {
			const secret = clip(secretInput.value.trim(), 80);
			if (!secret) return;
			round.secret = secret;
			round.hint = clip(hintInput.value.trim(), 80);
			emit("ctl", { t: "start", nick: me.nick, hint: round.hint });
		};
		panel.append(secretInput, hintInput, startButton);
	} else if (round.mine) {
		panel.appendChild(el("h2", 0, "You’re thinking of: " + round.secret));
		panel.appendChild(
			el(
				"p",
				0,
				"Answer questions in the chat. Wrong guesses so far: " + round.wrongGuesses,
			),
		);
		const row = el("div", "row");
		["Yes", "No", "Sort of"].forEach((word) => {
			const button = el("button", "btn alt", word);
			button.onclick = () => sendChat("answer", word);
			row.appendChild(button);
		});
		const reveal = el("button", "btn alt", "Give up and reveal");
		reveal.onclick = () => emit("ctl", { t: "reveal", secret: round.secret });
		row.appendChild(reveal);
		panel.appendChild(row);
	} else {
		panel.appendChild(el("h2", 0, round.thinkerNick + " is thinking of someone"));
		panel.appendChild(
			el(
				"p",
				0,
				(round.hint ? "Hint: " + round.hint + ". " : "") +
					"Ask questions with Send, then use Guess when you know. Wrong guesses so far: " +
					round.wrongGuesses,
			),
		);
	}
}

showLobby();
