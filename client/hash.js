self.importScripts('https://cdn.jsdelivr.net/npm/spark-md5@3.0.1/spark-md5.min.js')

// https://www.npmjs.com/package/spark-md5#hash-a-file-incrementally
self.onmessage = ({data: chunks}) => {
  const spark = new self.SparkMD5.ArrayBuffer();
  let progress = 0;
  let i = 0;
  const reader = new FileReader();
  reader.onload = e => {
    i++;
    spark.append(e.target.result);
    if (i === chunks.length) {
      self.postMessage({
        progress: 100,
        hash: spark.end()
      });
      self.close();
    } else {
      self.postMessage({
        progress: i / chunks.length * 100
      });
      loadNext();
    }
  };
  const loadNext = () => {
    reader.readAsArrayBuffer(chunks[i]);
  };
  loadNext();
}
