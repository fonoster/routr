/**
 * @author Pedro Sanders
 * @since v1
 */
var Status = {
  OK: 200,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  NOT_SUPPORTED: 405,
  INTERNAL_SERVER_ERROR: 500,
  message: {
    200: {value: 'Successful request.'},
    404: {value:'Resource not found.'},
    405: {value:'This operation is not supported by this implementation of the API. Code=0001'},
    500: {value:'Ups something when wrong with the server :('},
    400: {value:'Bad request.'}
  }
};