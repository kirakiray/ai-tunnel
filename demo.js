import { init } from "./index.js";

const { server, wss } = await init({
  port: 3000,
  // agentPath: "agent2",
  // chatPath: "chat2",
});
