/**
 * @author Pedro Sanders
 * @since v1
 */
export const Status = {
  OK: 200,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BAD_REQUEST: 400,
  NOT_SUPPORTED: 405,
  INTERNAL_SERVER_ERROR: 500,
  message: {
    200: {value:'Successful request'},
    404: {value:'Resource not found'},
    409: {value:'The request could not be completed due to a conflict with the current state of the target resource'},
    405: {value:'Operation not supported by data provider'},
    500: {value:'Ups something when wrong with the server :('},
    400: {value:'Bad request'}
  }
}