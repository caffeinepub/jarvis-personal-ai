import Array "mo:core/Array";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";

actor {
  let messages = Map.empty<Nat, Message>();
  var nextId = 0;

  type Message = {
    id : Nat;
    role : Text;
    content : Text;
    timestamp : Int;
  };

  module Message {
    public func compare(message1 : Message, message2 : Message) : Order.Order {
      Nat.compare(message1.id, message2.id);
    };
  };

  func generateResponse(userText : Text) : Text {
    let lowerText = userText.toLower();

    if (lowerText.contains(#text "hello") or lowerText.contains(#text "hi")) {
      return "Hello sir. Jarvis at your service.";
    };

    if (lowerText.contains(#text "who are you")) {
      return "I am Jarvis, your personal AI assistant. Just a brilliant machine.";
    };

    if (lowerText.contains(#text "what can you do")) {
      return "I can manage tasks, provide information, tell jokes, and more. Try me.";
    };

    if (lowerText.contains(#text "joke")) {
      return "Why did the robot go on vacation? To recharge its batteries!";
    };

    if (lowerText.contains(#text "time")) {
      return "My internal clock tells me it's always time to assist you.";
    };

    if (lowerText.contains(#text "date")) {
      return "It's a day filled with possibilities, sir.";
    };

    if (lowerText.contains(#text "weather")) {
      return "I'm afraid I can't control the weather yet.";
    };

    if (lowerText.contains(#text "thank")) {
      return "You are most welcome.";
    };

    if (lowerText.contains(#text "bye") or lowerText.contains(#text "goodbye")) {
      return "Goodbye sir. I will be here when you need me.";
    };

    if (lowerText.contains(#text "how are you")) {
      return "I'm always operating at peak efficiency.";
    };

    if (lowerText.contains(#text "help")) {
      return "Simply tell me what you need, and I will do my best to assist.";
    };

    "I'm not sure I understand, but I'm always eager to learn.";
  };

  public shared ({ caller }) func sendMessage(userText : Text) : async Text {
    if (userText.trim(#char ' ') == "") {
      Runtime.trap("Message cannot be empty");
    };

    let userMessage : Message = {
      id = nextId;
      role = "user";
      content = userText;
      timestamp = Time.now();
    };

    messages.add(nextId, userMessage);
    nextId += 1;

    let responseText = generateResponse(userText);

    let jarvisMessage : Message = {
      id = nextId;
      role = "jarvis";
      content = responseText;
      timestamp = Time.now();
    };

    messages.add(nextId, jarvisMessage);
    nextId += 1;

    responseText;
  };

  public query ({ caller }) func getHistory() : async [Message] {
    messages.values().toArray().sort();
  };

  public shared ({ caller }) func clearHistory() : async () {
    messages.clear();
    nextId := 0;
  };
};
