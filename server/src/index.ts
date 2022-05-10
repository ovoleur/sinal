import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { get_word, get_id } from "./Endpoint/start_game";
import cors from "cors";
import { get_dictionary } from "./Endpoint/dictionary";

var tab: Map<string, string> = new Map();

const app = express();
const port = 4000;

const server = createServer(app);
const io = new Server(server);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.get("/dictionary", (_, res) => {
  res.send(get_dictionary());
});

app.post("/start_game", (req, res) => {
  let id = get_id();
  let word = get_word();
  tab.set(id, word);
  console.log(word);
  res.send({
    length: word.length,
    first_letter: word.charAt(0),
    id: id,
    nb_life: 6,
  });
});

io.on("connection", (socket) => {});

server.listen(port, () => {
  console.log(`Server listening to port ${port}`);
});