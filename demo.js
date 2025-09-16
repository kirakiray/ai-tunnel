import { init } from "./index.js";

const { server, wss } = await init({
  port: 3000,
  // agentPath: "/agent2",
  // chatPath: "/chat2",
  // allow: ["localhost:3000", "os.tutous.com"],
});
