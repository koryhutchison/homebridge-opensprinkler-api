import fetch from 'node-fetch';
import { mocked } from 'ts-jest/utils';
import { OpenSprinklerApi } from '../openSprinklerApi';

jest.mock('node-fetch');

const api = new OpenSprinklerApi('password', 'localhost');

const mockFetch = mocked(fetch, true);

describe('OpenSprinklerApi', () => {
  afterEach(() => {
    mockFetch.mockClear();
  });

  const setup = response => {
    mockFetch.mockResolvedValueOnce(response);
  };

  describe('getInfo', () => {
    test('should return data correctly formatted', async () => {
      setup({ ok: true, json: () => ({ fwv: 219, hwv: 64, devid: 0 }) });
      const result = await api.getInfo();

      expect(result.deviceId).toEqual(0);
      expect(result.firmwareVersion).toEqual('2.1.9');
      expect(result.hardwareVersion).toEqual('OSPi');
    });

    test('should simply return the hardwareVersion if OpenSprinkler returns a string', async () => {
      setup({ ok: true, json: () => ({ fwv: 219, hwv: 'some string', devid: 0 }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('some string');
    });

    test('should return OSBo if version is 128', async () => {
      setup({ ok: true, json: () => ({ fwv: 219, hwv: 128, devid: 0 }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('OSBo');
    });

    test('should return Linux if version is 192', async () => {
      setup({ ok: true, json: () => ({ fwv: 219, hwv: 192, devid: 0 }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('Linux');
    });

    test('should return Demo if version is 255', async () => {
      setup({ ok: true, json: () => ({ fwv: 219, hwv: 255, devid: 0 }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('Demo');
    });

    test('should return 0.2 if version is 2', async () => {
      setup({ ok: true, json: () => ({ fwv: 219, hwv: 2, devid: 0 }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('0.2');
    });
  });

  describe('getValveStatus', () => {
    test('should return data correctly formatted', async () => {
      setup({ ok: true, json: () => ({ sn: [1, 0] }) });

      const config = [
        { name: 'Front yard', defaultDuration: 300 },
        { name: 'Back yard', defaultDuration: 300 },
      ];

      const result = await api.getValveStatus(config);

      expect(result).toStrictEqual({ 'Front yard': true, 'Back yard': false });
    });

    test('should only return the amount of valves provided in the config', async () => {
      setup({ ok: true, json: () => ({ sn: [1, 0] }) });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const result = await api.getValveStatus(config);

      expect(result).toStrictEqual({ 'Front yard': true });
    });
  });

  describe('setValve', () => {
    test('should call fetch with correct parameters when turning on', async () => {
      setup({ ok: true, json: () => ({ result: 1 }) });

      await api.setValve(1, 0, 300);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost/cm?pw=password&sid=0&en=1&t=300');
    });

    test('should call fetch with correct parameters when turning off', async () => {
      setup({ ok: true, json: () => ({ result: 1 }) });

      await api.setValve(0, 0, 300);

      expect(mockFetch).toHaveBeenCalledWith('http://localhost/cm?pw=password&sid=0&en=0&t=300');
    });

    test('should return correct message on failure', async () => {
      setup({ ok: true, json: () => ({ result: 2 }) });

      try {
        await api.setValve(0, 0, 300);
      } catch (error) {
        expect(error.message).toEqual('Failed to set valve');
      }
    });

    test('should return correct message on fetch failure', async () => {
      setup({ ok: false, status: 500, text: () => 'Some error message' });

      try {
        await api.setValve(0, 0, 300);
      } catch (error) {
        expect(error.message).toEqual('Request to cm failed. Status Code: 500 Message: Some error message');
      }
    });
  });
});
