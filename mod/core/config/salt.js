/**
 * @author Pedro Sanders
 * @since v1
 */
const FilesUtil = require('@routr/utils/files_util')
const System = Java.type('java.lang.System')
const File = Java.type('java.io.File')
const UUID = Java.type('java.util.UUID')

function getSalt () {
  if (System.getenv('ROUTR_SALT') !== null) return System.getenv('ROUTR_SALT')

  const pathToSalt =
    System.getenv('ROUTR_SALT_FILE') !== null
      ? System.getenv('ROUTR_SALT_FILE')
      : `${System.getProperty('user.dir')}/.routr.salt`

  const f = new File(pathToSalt)

  if (f.exists() && !f.isDirectory()) return FilesUtil.readFile(pathToSalt)

  const genSalt = UUID.randomUUID()
    .toString()
    .replace(/\-/g, '')
  FilesUtil.writeFile(pathToSalt, genSalt)

  return genSalt
}

module.exports = {
  getSalt
}
