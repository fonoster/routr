package io.routr.events;

// Enum for event types
public enum EventTypes {
  // Event types
  CALL_STARTED("call.started"),
  CALL_ENDED("call.ended");

  // Type
  private final String type;

  // Constructor
  EventTypes(String type) {
    this.type = type;
  }

  // Get type
  public String getType() {
    return type;
  }
}