/**
 * @author Pedro Sanders
 * @since v1
 */
const BufferedWriter = Packages.java.io.BufferedWriter
const File = Packages.java.io.File
const Files = Packages.java.nio.file.Files
const FileWriter = Packages.java.io.FileWriter
const Paths = Packages.java.nio.file.Paths

class FilesUtil {

    static readFile(path) {
        const lines = Files.readAllLines(Paths.get(path), Packages.java.nio.charset.StandardCharsets.UTF_8)
        const data = []
        lines.forEach(line => { data.push(line) })
        return data.join('\n').trim()
    }

    static writeFile(path, text) {
      const file = new File (path)
      const out = new BufferedWriter(new FileWriter(file))
      out.write(text)
      out.close()
    }

}

module.exports = FilesUtil
