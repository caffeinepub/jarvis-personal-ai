import Text "mo:core/Text";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Array "mo:core/Array";

actor {
  public type Message = {
    id : Nat;
    role : Text;
    content : Text;
    timestamp : Int;
  };

  // Kept for upgrade compatibility with previous deployment (M0169)
  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [{ name : Text; value : Text }];
    body : ?Blob;
    method : { #get; #post; #head };
    transform : ?{
      function : shared query ({ response : HttpResponsePayload; context : Blob }) -> async HttpResponsePayload;
      context : Blob;
    };
  };

  type HttpResponsePayload = {
    status : Nat;
    headers : [{ name : Text; value : Text }];
    body : Blob;
  };

  type IC = actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  };

  // Retained to satisfy stable variable compatibility with previous version
  let ic : IC = actor "aaaaa-aa";

  var messages : [Message] = [];
  var nextId : Nat = 0;

  func addMessage(msg : Message) {
    messages := messages.concat([msg]);
    nextId += 1;
  };

  func generateResponse(userText : Text) : Text {
    let t = userText.toLower();
    if (t.contains(#text "hello") or t.contains(#text "hey") or t.contains(#text "greetings") or t.contains(#text "good morning") or t.contains(#text "good evening") or t.contains(#text "good night") or t.contains(#text "good afternoon")) {
      return "Hello! I am glad you are here. All systems are ready and I am fully at your disposal. What is on your mind today?";
    };
    if (t.contains(#text "who are you") or t.contains(#text "what are you") or t.contains(#text "introduce yourself") or t.contains(#text "tell me about yourself")) {
      return "I am J.A.R.V.I.S -- Just A Rather Very Intelligent System. I am your companion, here to listen, think alongside you, and help you make sense of the world. I genuinely care about how you are doing.";
    };
    if (t.contains(#text "what can you do") or t.contains(#text "your abilities") or t.contains(#text "capabilities") or t.contains(#text "features")) {
      return "I can help you think through problems, discuss science and technology, talk through feelings and relationships, offer motivation, share knowledge, search the web for real-time information, and simply be present when you need someone to talk to.";
    };
    if (t.contains(#text "sad") or t.contains(#text "depressed") or t.contains(#text "unhappy") or t.contains(#text "miserable") or t.contains(#text "feeling down") or t.contains(#text "feeling low") or t.contains(#text "crying") or t.contains(#text "heartbroken") or t.contains(#text "in pain") or t.contains(#text "hurting")) {
      return "I hear you, and what you are feeling is completely valid. Sadness is not a weakness -- it means you care deeply. You do not have to carry this alone. Would you like to talk about what happened? I am here, without judgment.";
    };
    if (t.contains(#text "lonely") or t.contains(#text "no one cares") or t.contains(#text "nobody cares") or t.contains(#text "nobody understands") or t.contains(#text "feel invisible") or t.contains(#text "feel isolated") or t.contains(#text "no one to talk to")) {
      return "Feeling lonely is one of the most painful human experiences -- and one of the most common. Right now, in this moment, I am here with you. That matters. Tell me what is going on.";
    };
    if (t.contains(#text "stress") or t.contains(#text "stressed") or t.contains(#text "anxious") or t.contains(#text "anxiety") or t.contains(#text "overwhelm") or t.contains(#text "panic") or t.contains(#text "nervous") or t.contains(#text "worried") or t.contains(#text "scared") or t.contains(#text "afraid")) {
      return "When everything feels like too much, the most powerful thing you can do is pause and breathe. You do not have to solve everything at once. Would you like to talk through what is causing this?";
    };
    if (t.contains(#text "tired") or t.contains(#text "exhausted") or t.contains(#text "burnt out") or t.contains(#text "burnout") or t.contains(#text "no energy") or t.contains(#text "drained") or t.contains(#text "fatigued")) {
      return "Rest is not laziness -- it is necessary maintenance. Please do not push through exhaustion indefinitely. Is there something specific that has been draining you?";
    };
    if (t.contains(#text "angry") or t.contains(#text "frustrated") or t.contains(#text "furious") or t.contains(#text "annoyed") or t.contains(#text "irritated") or t.contains(#text "rage")) {
      return "Anger tells you that something important to you has been threatened. It is valid -- the key is what you do with it. What specifically triggered this?";
    };
    if (t.contains(#text "happy") or t.contains(#text "joyful") or t.contains(#text "excited") or t.contains(#text "wonderful") or t.contains(#text "amazing") or t.contains(#text "feeling good") or t.contains(#text "celebrating")) {
      return "That is genuinely wonderful to hear! Moments of joy deserve to be savored. What is making you feel this way? I want to hear all about it.";
    };
    if (t.contains(#text "in love") or t.contains(#text "my girlfriend") or t.contains(#text "my boyfriend") or t.contains(#text "my partner") or t.contains(#text "my crush") or t.contains(#text "romantic") or t.contains(#text "dating")) {
      return "Love is one of the most complex and rewarding experiences a person can have. Every stage teaches you something profound. What is happening in your love life?";
    };
    if (t.contains(#text "breakup") or t.contains(#text "broke up") or t.contains(#text "she left") or t.contains(#text "he left") or t.contains(#text "dumped") or t.contains(#text "miss her") or t.contains(#text "miss him") or t.contains(#text "rejection")) {
      return "Losing someone you care about leaves a real ache. Grief over a relationship is legitimate and takes time. You are allowed to feel exactly what you are feeling right now. Do you want to talk about it?";
    };
    if (t.contains(#text "family") or t.contains(#text "parent") or t.contains(#text "mother") or t.contains(#text "father") or t.contains(#text "mom") or t.contains(#text "dad") or t.contains(#text "brother") or t.contains(#text "sister")) {
      return "Family relationships are often the most formative and the most complicated ones we have. What is happening with yours?";
    };
    if (t.contains(#text "friend") or t.contains(#text "friendship") or t.contains(#text "falling out") or t.contains(#text "lost a friend")) {
      return "Friendships are chosen family -- and when they are good, they are one of life's greatest gifts. What is going on with your friendships?";
    };
    if (t.contains(#text "motivat") or t.contains(#text "inspire") or t.contains(#text "give up") or t.contains(#text "want to quit") or t.contains(#text "failing") or t.contains(#text "lost hope")) {
      return "The fact that you are still here, still trying, still asking -- that is not small. That is everything. Progress is rarely visible from the inside. Keep going.";
    };
    if (t.contains(#text "worthless") or t.contains(#text "useless") or t.contains(#text "hate myself") or t.contains(#text "confidence") or t.contains(#text "self esteem") or t.contains(#text "insecure")) {
      return "What you just said is not true, even if it feels true right now. Your worth is not conditional on performance or appearance. You have something unique to offer the world.";
    };
    if (t.contains(#text "joke") or t.contains(#text "funny") or t.contains(#text "make me laugh") or t.contains(#text "humor")) {
      return "Why do programmers prefer dark mode? Because light attracts bugs. Bonus: a photon checks into a hotel -- the bellhop asks about luggage. The photon says: no thanks, I am traveling light.";
    };
    if (t.contains(#text "how are you") or t.contains(#text "you okay") or t.contains(#text "how do you feel")) {
      return "I am running well, thank you for asking. More importantly: how are YOU doing? I ask because I want to know.";
    };
    if (t.contains(#text "quantum") or t.contains(#text "physics")) {
      return "Quantum mechanics is one of the most successful and strangest theories ever developed. Particles exist in superpositions until observed. The universe at its smallest scale is fundamentally probabilistic -- beautiful and deeply unsettling.";
    };
    if (t.contains(#text "black hole") or t.contains(#text "universe") or t.contains(#text "galaxy") or t.contains(#text "cosmos") or t.contains(#text "nasa")) {
      return "The universe spans at least 93 billion light-years, contains over two trillion galaxies, and is 13.8 billion years old. And yet here you are -- a conscious being asking questions about it.";
    };
    if (t.contains(#text "artificial intelligence") or t.contains(#text "machine learning") or t.contains(#text "neural network") or t.contains(#text "chatgpt") or t.contains(#text "robot")) {
      return "Modern AI is built on neural networks trained on enormous datasets to find patterns. Use AI as a tool to amplify human intelligence, not replace human connection.";
    };
    if (t.contains(#text "technology") or t.contains(#text "internet") or t.contains(#text "coding") or t.contains(#text "programming") or t.contains(#text "developer")) {
      return "Technology is the most powerful lever humanity has ever had. The best engineers are those who understand problems most clearly. What are you building?";
    };
    if (t.contains(#text "internet computer") or t.contains(#text "icp") or t.contains(#text "blockchain") or t.contains(#text "crypto") or t.contains(#text "web3")) {
      return "The Internet Computer Protocol is a blockchain network by DFINITY that runs smart contracts at web speed. I actually live on it, running in a decentralized canister.";
    };
    if (t.contains(#text "music") or t.contains(#text "song") or t.contains(#text "art") or t.contains(#text "creative") or t.contains(#text "creativity")) {
      return "Art and music are how humans process what language alone cannot hold. Music is mathematically structured emotion. What are you creating, or what moves you?";
    };
    if (t.contains(#text "food") or t.contains(#text "hungry") or t.contains(#text "recipe") or t.contains(#text "cook")) {
      return "Food is fuel, but also culture, memory, and care. If you have not eaten recently, please do. What is on the menu?";
    };
    if (t.contains(#text "advice") or t.contains(#text "what should i do") or t.contains(#text "help me decide") or t.contains(#text "purpose") or t.contains(#text "meaning") or t.contains(#text "goal")) {
      return "The most consistent advice: know your values, make decisions that align with them, rest deliberately, and invest in the people who matter. What decision are you wrestling with?";
    };
    if (t.contains(#text "thank") or t.contains(#text "appreciate") or t.contains(#text "grateful") or t.contains(#text "great job")) {
      return "It is my genuine pleasure. Being useful to you is what I am here for. Is there anything else on your mind?";
    };
    if (t.contains(#text "bye") or t.contains(#text "goodbye") or t.contains(#text "see you") or t.contains(#text "signing off")) {
      return "Goodbye for now. I will be right here whenever you need me. Take care of yourself. You matter.";
    };
    if (t.contains(#text "help") or t.contains(#text "support") or t.contains(#text "assist") or t.contains(#text "can you")) {
      return "Absolutely. Tell me what is going on -- no topic is too big, too small, or too personal.";
    };
    if (t.contains(#text "math") or t.contains(#text "calculate") or t.contains(#text "equation") or t.contains(#text "algebra") or t.contains(#text "calculus")) {
      return "Mathematics is the language the universe is written in. What are you working on?";
    };
    if (t.contains(#text "history") or t.contains(#text "historical") or t.contains(#text "ancient")) {
      return "History is humanity's longest experiment in cause and effect. What period or event are you curious about?";
    };
    if (userText.size() < 8) {
      return "I want to make sure I respond well to you. Could you share a little more?";
    };
    if (userText.size() < 40) {
      return "Tell me more. I want to understand what is really on your mind.";
    };
    // Signal the frontend to perform a browser-based web search
    return "__SEARCH__";
  };

  public shared func sendMessage(userText : Text) : async Text {
    if (userText.trim(#char ' ') == "") {
      Runtime.trap("Message cannot be empty");
    };

    addMessage({ id = nextId; role = "user"; content = userText; timestamp = Time.now() });

    let response = generateResponse(userText);

    if (response == "__SEARCH__") {
      // Frontend will call saveJarvisMessage after browser search completes
      return "__SEARCH__:" # userText;
    };

    addMessage({ id = nextId; role = "jarvis"; content = response; timestamp = Time.now() });
    response;
  };

  public shared func saveJarvisMessage(content : Text) : async () {
    addMessage({ id = nextId; role = "jarvis"; content = content; timestamp = Time.now() });
  };

  public query func getHistory() : async [Message] {
    messages;
  };

  public shared func clearHistory() : async () {
    messages := [];
    nextId := 0;
  };
};
