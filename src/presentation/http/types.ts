import { AuthContext } from "../../application/authz/authContext";
import { Container } from "../../infrastructure/container";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
  interface FastifyInstance {
    container: Container;
  }
}
