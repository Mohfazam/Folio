import plivo from "plivo";
import { env } from "../../config/env";

export const plivoClient = new plivo.Client(env.plivoAuthId, env.plivoAuthToken);
