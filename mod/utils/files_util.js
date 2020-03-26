/**
 * @author Pedro Sanders
 * @since v1
 */
const BufferedWriter = Java.type('java.io.BufferedWriter')
const File = Java.type('java.io.File')
const Files = Java.type('java.nio.file.Files')
const FileWriter = Java.type('java.io.FileWriter')
const Paths = Java.type('java.nio.file.Paths')

class FilesUtil {
  static readFile (path) {
    const lines = Files.readAllLines(
      Paths.get(path),
      Java.type('java.nio.charset.StandardCharsets').UTF_8
    )
    const data = []
    lines.forEach(line => {
      data.push(line)
    })
    return data.join('\n').trim()
  }

  static writeFile (path, text) {
    const file = new File(path)
    const out = new BufferedWriter(new FileWriter(file))
    out.write(text)
    out.close()
  }
}

module.exports = FilesUtil
