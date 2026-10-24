import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      image?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    email?: string;
    name?: string;
  }
}
