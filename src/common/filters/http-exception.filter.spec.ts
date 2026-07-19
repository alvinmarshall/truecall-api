import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

const makeHost = (url = '/test') => {
  const jsonFn = jest.fn();
  const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusFn }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost,
    statusFn,
    jsonFn,
  };
};

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
  });

  it('handles HttpException with string message', () => {
    const { host, statusFn, jsonFn } = makeHost();
    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), host);
    expect(statusFn).toHaveBeenCalledWith(404);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Not found',
        path: '/test',
      }),
    );
  });

  it('handles HttpException with object message containing message field', () => {
    const { host, jsonFn } = makeHost();
    filter.catch(
      new HttpException({ message: 'Validation failed' }, 400),
      host,
    );
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Validation failed',
      }),
    );
  });

  it('handles HttpException with object message missing message field', () => {
    const { host, jsonFn } = makeHost();
    filter.catch(new HttpException({ error: 'Bad' } as never, 400), host);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it('handles non-HttpException as 500 with generic message', () => {
    const { host, statusFn, jsonFn } = makeHost();
    filter.catch(new Error('unexpected'), host);
    expect(statusFn).toHaveBeenCalledWith(500);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
      }),
    );
  });

  it('includes request path and timestamp in response', () => {
    const { host, jsonFn } = makeHost('/api/resource');
    filter.catch(new HttpException('error', 400), host);
    const calls = jsonFn.mock.calls as [Record<string, unknown>][];
    const payload = calls[0][0];
    expect(payload.path).toBe('/api/resource');
    expect(typeof payload.timestamp).toBe('string');
  });
});
