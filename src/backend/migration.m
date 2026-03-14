import Array "mo:core/Array";
import Text "mo:core/Text";
import Nat "mo:core/Nat";

module {
  type Message = {
    id : Nat;
    role : Text;
    content : Text;
    timestamp : Int;
  };

  type OldActor = {
    messages : [Message];
    nextId : Nat;
  };

  type NewActor = {
    messages : [Message];
    nextId : Nat;
    adminPasswordHash : Text;
    apiKeyNames : [Text];
    apiKeyValues : [Text];
  };

  public func run(old : OldActor) : NewActor {
    {
      old with
      adminPasswordHash = "";
      apiKeyNames = [];
      apiKeyValues = [];
    };
  };
};
