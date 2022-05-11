import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { get_word, get_id } from "./Endpoint/start_game";
import cors from "cors";
import { get_dictionary } from "./Endpoint/dictionary";
import { v4 as uuidv4 } from 'uuid';
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export var idToWord : Map<string,string> = new Map();

const app = express();
const port = 4000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000"
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.get("/dictionary", (_, res) => {
  res.send(get_dictionary());
});

app.post("/start_game", (req, res) => {
 let id = get_id();
 let word = get_word();
 idToWord.set(id, word);
 console.log(word);
 res.send( {length:word.length, first_letter:word.charAt(0), id:id, nb_life:6});
});

app.post("/room", (req, res) => {
 });
io.on("connection", (socket) => {
  socket.on('create', function(room) {
    socket.join(room);
    console.log(room);
  });
  socket.on('create', function({ room, result }) {
    console.log(room);
    io.to(room).emit('update', result);
  });
 
});

server.listen(port, () => {
  console.log(`Server listening to port ${port}`);
});
