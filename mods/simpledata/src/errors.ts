import grpc = require("@grpc/grpc-js")

export class UnimplementedError extends Error {
  code: number;
  constructor() {
    super(`this operation is not supported/enabled in this data api implementation.`);
    this.code = grpc.status.UNIMPLEMENTED
    Object.setPrototypeOf(this, UnimplementedError.prototype);
  }
}

export class ResourceNotFound extends Error {
  code: number;
  constructor(ref: string) {
    super(`resource not found: ${ref}`);
    this.code = grpc.status.NOT_FOUND
    Object.setPrototypeOf(this, ResourceNotFound.prototype);
  }
}

export class BadRequest extends Error {
  code: number;
  constructor(message?: string) {
    super(message || 'bad request');
    this.code = grpc.status.INVALID_ARGUMENT
    Object.setPrototypeOf(this, BadRequest.prototype);
  }
}