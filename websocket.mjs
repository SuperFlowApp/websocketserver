import WebSocket from "ws";
import express from "express";
import cors from "cors";

const app = express();
const PORT = 3002;

app.use(cors());

// Store latest data for each stream
const latestData = {
  orderbook: null,
  trades: null,
};

// Store WebSocket instances
const wsConnections = {};

/**
 * Connects to a WebSocket and updates latestData.
 * @param {string} key - 'orderbook' or 'trades'
 * @param {string} url - WebSocket URL
 */
function fetchWebSocketData(key, url) {
  const ws = new WebSocket(url);
  wsConnections[key] = ws;

  ws.on("open", () => {
    console.log(`WebSocket (${key}) connection established.`);
  });

  ws.on("message", (data) => {
    try {
      const parsedData = JSON.parse(data);
      latestData[key] = parsedData;
      // Notify listeners if any
      if (listeners[key]) {
        listeners[key].forEach((fn) => fn(parsedData));
      }
    } catch (error) {
      console.error(`Error parsing WebSocket (${key}) message:`, error);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket (${key}) connection closed.`);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket (${key}) error:`, error);
  });
}

// Listeners for SSE clients
const listeners = {
  orderbook: [],
  trades: [],
};

// Start fetching both streams
fetchWebSocketData("orderbook", "wss://meta-test.rasa.capital/ws/orderbook/BTCUSDT");
fetchWebSocketData("trades", "wss://meta-test.rasa.capital/ws/trades/BTCUSDT");

// SSE endpoint for orderbook
app.get("/stream/orderbook", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send latest data immediately
  if (latestData.orderbook) {
    res.write(`data: ${JSON.stringify(latestData.orderbook)}\n\n`);
  }

  // Listener function
  const sendData = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  listeners.orderbook.push(sendData);

  req.on("close", () => {
    // Remove listener on disconnect
    listeners.orderbook = listeners.orderbook.filter((fn) => fn !== sendData);
    console.log("Client disconnected from SSE (orderbook).");
  });
});

// SSE endpoint for trades
app.get("/stream/trades", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (latestData.trades) {
    res.write(`data: ${JSON.stringify(latestData.trades)}\n\n`);
  }

  const sendData = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  listeners.trades.push(sendData);

  req.on("close", () => {
    listeners.trades = listeners.trades.filter((fn) => fn !== sendData);
    console.log("Client disconnected from SSE (trades).");
  });
});

app.listen(PORT, () => {
  console.log(`SSE server running on:`);
  console.log(`  http://localhost:${PORT}/stream/orderbook`);
  console.log(`  http://localhost:${PORT}/stream/trades`);
});
