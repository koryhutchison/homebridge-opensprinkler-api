import fetch from 'node-fetch';
import { OpenSprinklerApi } from '../openSprinklerApi';

jest.mock('node-fetch');

const api = new OpenSprinklerApi('password', 'localhost');

const mockFetch = jest.mocked(fetch);

describe('OpenSprinklerApi', () => {
  afterEach(() => {
    mockFetch.mockClear();
  });

  const setup = response => {
    mockFetch.mockResolvedValueOnce(response);
  };

  describe('getInfo', () => {
    test('should return data correctly formatted', async () => {
      setup({ ok: true, json: () => ({ options: { fwv: 219, hwv: 64 }, settings: { mac: "BA:BA:BA:BA:BA:BA", loc: 'xx.xxxx' } }) });
      const result = await api.getInfo();

      expect(result.macAddress).toEqual("BA:BA:BA:BA:BA:BA");
      expect(result.systemLocation).toEqual('xx.xxxx');
      expect(result.firmwareVersion).toEqual('2.1.9');
      expect(result.hardwareVersion).toEqual('OSPi');
    });

    test('should simply return the hardwareVersion if OpenSprinkler returns a string', async () => {
      setup({ ok: true, json: () => ({ options: { fwv: 219, hwv: 'some string' }, settings: { mac: "BA:BA:BA:BA:BA:BA"} }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('some string');
    });

    test('should return OSBo if version is 128', async () => {
      setup({ ok: true, json: () => ({ options: { fwv: 219, hwv: 128 }, settings: { mac: "BA:BA:BA:BA:BA:BA"} }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('OSBo');
    });

    test('should return Linux if version is 192', async () => {
      setup({ ok: true, json: () => ({ options: { fwv: 219, hwv: 192 }, settings: { mac: "BA:BA:BA:BA:BA:BA"} }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('Linux');
    });

    test('should return Demo if version is 255', async () => {
      setup({ ok: true, json: () => ({ options: { fwv: 219, hwv: 255 }, settings: { mac: "BA:BA:BA:BA:BA:BA"} }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('Demo');
    });

    test('should return 0.2 if version is 2', async () => {
      setup({ ok: true, json: () => ({ options: { fwv: 219, hwv: 2 }, settings: { mac: "BA:BA:BA:BA:BA:BA"} }) });
      const result = await api.getInfo();

      expect(result.hardwareVersion).toEqual('0.2');
    });
  });

  describe('getSystemStatus', () => {
    test('should return data correctly formatted', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [0, 30, 123456],
              [1, 0, 123456],
            ],
            rd: 0,
          },
          programs: { pd: [[0]] },
        }),
      });

      const config = [
        { name: 'Front yard', defaultDuration: 300 },
        { name: 'Back yard', defaultDuration: 300 },
      ];

      const { valveStatuses, rainDelay, programStatus } = await api.getSystemStatus(config);

      expect(valveStatuses).toStrictEqual({
        'Front yard': { isActive: true, remainingDuration: 30 },
        'Back yard': { isActive: false, remainingDuration: 0 },
      });
      expect(rainDelay).toEqual(false);
      expect(programStatus).toEqual('off');
    });

    test('should only return the amount of valves provided in the config', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [0, 30, 123456],
              [1, 0, 123456],
            ],
            rd: 0,
          },
          programs: { pd: [[0]] },
        }),
      });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const { valveStatuses } = await api.getSystemStatus(config);

      expect(valveStatuses).toStrictEqual({ 'Front yard': { isActive: true, remainingDuration: 30 } });
    });

    test('should return true for RainDelay if value is 1', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [0, 30, 123456],
              [1, 0, 123456],
            ],
            rd: 1,
          },
          programs: { pd: [[0]] },
        }),
      });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const { rainDelay } = await api.getSystemStatus(config);

      expect(rainDelay).toEqual(true);
    });

    test('should set program status to scheduled if the first bit is 1', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [0, 30, 123456],
              [1, 0, 123456],
            ],
            rd: 1,
          },
          programs: { pd: [[49]] },
        }),
      });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const { programStatus } = await api.getSystemStatus(config);

      expect(programStatus).toEqual('scheduled');
    });

    test('should set program status to manual if the first valve is set to program ID 99', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [99, 30, 123456],
              [1, 0, 123456],
            ],
            rd: 1,
          },
          programs: { pd: [[48]] },
        }),
      });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const { programStatus } = await api.getSystemStatus(config);

      expect(programStatus).toEqual('manual');
    });

    test('should set program status to manual if the 4th valve is set to program ID 99', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [0, 30, 123456],
              [1, 0, 123456],
              [2, 0, 123456],
              [99, 0, 123456],
            ],
            rd: 1,
          },
          programs: { pd: [[48]] },
        }),
      });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const { programStatus } = await api.getSystemStatus(config);

      expect(programStatus).toEqual('manual');
    });

    test('should set program status to override if a program id is 99 and a program is scheduled', async () => {
      setup({
        ok: true,
        json: () => ({
          status: { sn: [1, 0] },
          settings: {
            ps: [
              [0, 30, 123456],
              [1, 0, 123456],
              [2, 0, 123456],
              [99, 0, 123456],
            ],
            rd: 1,
          },
          programs: { pd: [[49]] },
        }),
      });

      const config = [{ name: 'Front yard', defaultDuration: 300 }];

      const { programStatus } = await api.getSystemStatus(config);

      expect(programStatus).toEqual('override');
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
      expect.assertions(1);
      setup({ ok: true, json: () => ({ result: 2 }) });

      try {
        await api.setValve(0, 0, 300);
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toEqual('Failed to set valve');
        }
      }
    });

    test('should return correct message on fetch failure', async () => {
      expect.assertions(1);
      setup({ ok: false, status: 500, text: () => 'Some error message' });

      try {
        await api.setValve(0, 0, 300);
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toEqual('Request to cm failed. Status Code: 500 Message: Some error message');
        }
      }
    });
  });

  describe('checkSupport', () => {
    test('should return true if the firmware version is greater than 2.1.5', async () => {
      setup({ ok: true, json: () => ({ fwv: 216 }) });

      const result = await api.checkSupport();

      expect(result).toBe(true);
    });

    test('should return false if the firmware version is less than 2.1.6', async () => {
      setup({ ok: true, json: () => ({ fwv: 215 }) });

      const result = await api.checkSupport();

      expect(result).toBe(false);
    });
  })
});
