export class ParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParsingError";
  }
}

export class HttpRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HttpRequestError";
  }
}
