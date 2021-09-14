import { RequestHandler } from "./types";

export class RegisterHandler implements RequestHandler {
  match(request: RouteReqRequest): boolean {
    throw new Error("Method not implemented.");
  }

  process(request: RouteReqRequest): Promise<any> {
    pipe([
      acl(request),
      register(request)
    ]).output(() => {

    })
  }
}