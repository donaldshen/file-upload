const http = require('http')
const path = require('path')
const fse = require('fs-extra')
const Busboy = require('busboy')
const util = require('util')

const server = http.createServer()
const UPLOAD_DIR = path.resolve(__dirname, 'files')

server.on('request', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  if (req.method === 'OPTIONS') {
    res.status = 200
    res.end()
  } else if (req.url === '/verify') {
    controller.handleVerifyUpload(req, res)
  } else if (req.url === '/') {
    controller.handleUpload(req, res)
  } else {
    res.status = 200
    res.end()
  }
})

server.listen(3333, () => console.log('start listening to 3333'))

const controller = {
  async handleVerifyUpload(req, res) {
    // 文件在服务器是以 hash 存储的，感觉直接传 hash + ext 也可以
    const { fileName, hash } = await readFromStream(req)
    const ext = path.extname(fileName)
    const newFileName = hash + ext
    const filePath = path.resolve(UPLOAD_DIR, newFileName)
    if (fse.existsSync(filePath)) {
      res.end(JSON.stringify({ uploaded: true }))
    } else {
      const uploadedChunks = await getUploadedChunks(hash)
      res.end(JSON.stringify({ uploaded: false, uploadedChunks }))
    }
  },
  async handleUpload(req, res) {
    const busboy = new Busboy({ headers: req.headers })
    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
      console.log(
        'File [' +
          fieldname +
          ']: filename: ' +
          filename +
          ', encoding: ' +
          encoding +
          ', mimetype: ' +
          mimetype,
      )
      file.on('data', function (data) {
        console.log('File [' + fieldname + '] got ' + data.length + ' bytes')
      })
      file.on('end', function () {
        console.log('File [' + fieldname + '] Finished')
      })
    })
    busboy.on('field', function (fieldname, val) {
      console.log('Field [' + fieldname + ']: value: ' + util.inspect(val))
    })
    busboy.on('finish', function () {
      console.log('Done parsing form!')
      // res.writeHead(303, { Connection: 'close', Location: '/' })
      res.end()
    })
    req.pipe(busboy)
  },
}

function readFromStream(stream) {
  return new Promise((resolve) => {
    let result = ''
    stream.on('data', (d) => (result += d))
    stream.on('end', () => resolve(JSON.parse(result)))
  })
}

function getUploadedChunks(hash) {
  const chunksPath = path.resolve(UPLOAD_DIR, hash)
  if (fse.existsSync(chunksPath)) {
    return fse.readdir(chunksPath).map(getIndex)
  } else {
    return []
  }
}

function getChunkName(hash, i) {
  return hash + '-' + i
}

function getIndex(chunkName) {
  return +chunkName.split('-')[1]
}
