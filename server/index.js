const http = require("http");
const path = require("path");
const fse = require("fs-extra");

const server = http.createServer();
const UPLOAD_DIR = path.resolve(__dirname, "files");

server.on("request", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.status = 200;
    res.end();
  } else if (req.url === "/verify") {
    controller.handleVerifyUpload(req, res);
  } else {
    res.status = 200;
    res.end();
  }
});

server.listen(3333, () => console.log("start listening to 3333"));

const controller = {
  async handleVerifyUpload(req, res) {
    const { fileName, fileHash } = await readFromStream(req);
    const ext = path.extname(fileName);
    const newFileName = fileHash + ext;
    const filePath = path.resolve(UPLOAD_DIR, newFileName);
    if (fse.existsSync(filePath)) {
      res.end(JSON.stringify({ uploaded: true }));
    } else {
      const uploadedList = await getUploadedList(fileHash);
      res.end(JSON.stringify({ uploaded: false, uploadedList }));
    }
  },
};

function readFromStream(stream) {
  return new Promise((resolve) => {
    let result = "";
    stream.on("data", (d) => (result += d));
    stream.on("end", () => resolve(JSON.parse(result)));
  });
}

function getUploadedList(fileHash) {
  const chunksPath = path.resolve(UPLOAD_DIR, fileHash)
  if (fse.existsSync(chunksPath)) {
    return fse.readdir(chunksPath)
  } else {
    return []
  }
}
