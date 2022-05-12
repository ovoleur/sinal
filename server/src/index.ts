import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { get_word, get_id } from "./Endpoint/start_game";
import cors from "cors";
import { get_dictionary } from "./Endpoint/dictionary";
import { get_guess } from "./Endpoint/guess";
import { v4 as uuidv4 } from "uuid";
import "./utils/type.ts";
import { Lobby, lobbyMap, playerMap } from "./utils/type";

export var idToWord: Map<string, string> = new Map();
let rooms: Map<string, Array<Socket>> = new Map();

const app = express();
const port = 4000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
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
  res.send({
    length: word.length,
    first_letter: word.charAt(0),
    id: id,
    nb_life: 6,
  });
});

app.post("/guess", (req, res) => {
  let id = req.body.id;
  let word = req.body.word;
  console.log(io.sockets);
  res.send(get_guess(id, word, idToWord));
});

io.on("connection", (socket) => {
 console.log("connected");
 socket.on('create', function(room) {
  console.log(rooms);
  socket.join(room);
 });

 socket.on("create_lobby", function({ mode, place, isPublic, owner, name }) {
  let lobby = new Lobby();
  let lobbyId = get_id();

  lobby.id = lobbyId;
  lobby.state = "pre-game";
  lobby.name = name;
  if ( mode == "1vs1" )
    lobby.totalPlace = 2;
  else
    lobby.totalPlace = place;

  lobby.currentPlace = 1;
  let player = playerMap.get(owner);
  if ( player !== undefined )
    lobby.playerList.push( player );

  lobby.owner = owner;
  lobby.isPublic = isPublic;
  lobby.mode = mode;

  lobbyMap.set(lobbyId, lobby);

  socket.join(lobbyId);
  socket.emit("create_lobby_response", lobbyId);
  
 });
 socket.on('join_lobby', function(result) {
  if(lobbyMap.get(result.lobbyId) !== undefined) {
    if(lobbyMap.get(result.lobbyId)!.currentPlace < lobbyMap.get(result.lobbyId)!.totalPlace) {
      socket.join(result.lobbyId);
      lobbyMap.get(result.lobbyId)!.playerList[lobbyMap.get(result.lobbyId)!.currentPlace];
      lobbyMap.get(result.lobbyId)!.currentPlace++;
      playerMap.set(result.playerId, {id:result.playerId, name:result.playerName});
      socket.emit("join_lobby_response", {success: true,
        message: "Le lobby à été rejoins !"});
    } else {
      socket.emit("join_lobby_response", {success: false,
        message: "Le lobby est déja plein !"});
    }
  } else {
    console.log("enter");
    socket.emit("join_lobby_response", {success: false,
      message: "Le lobby donné n'existe pas !"});
  }
});

});

io.on("leave_lobby", (socket, room) => {
  socket.leave(room)
  
})

io.on("disconnect", (socket) => {

})

server.listen(port, () => {
  console.log(`Server listening to port ${port}`);
});
