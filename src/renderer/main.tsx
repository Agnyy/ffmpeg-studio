import React from "react";
import ReactDOM from "react-dom/client";
import { installVideoSrcTrap } from "../media/videoSrcTrap";
import App from "./App";
import "./styles.css";

installVideoSrcTrap();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
