import lazyLoadObj from './index';

type Test = {
  id: number;
  prop: number;
  other: number;
};

describe('lazyLoadObj()', (): void => {
  const loader = jest.fn(
    async (
      { id }: Pick<Test, 'id'> & Omit<Partial<Test>, 'id'>,
      properties: readonly (keyof Test)[],
    ): Promise<Partial<Test>> => {
      const loaded: Partial<Test> = {};
      if (properties.includes('prop')) {
        loaded.prop = 2 * id;
      }
      if (properties.includes('other')) {
        loaded.other = 3 * id;
      }
      return loaded;
    },
  );

  afterEach((): void => {
    loader.mockClear();
  });

  it('loads one member', async (): Promise<void> => {
    const init = { id: 1 };
    const obj = lazyLoadObj(init, loader);
    const promise = obj.prop;
    expect(promise).toBeInstanceOf(Promise);
    const value = await promise;
    expect(value).toBe(2);
    expect((init as Test).prop).toBe(value); // must modify the init object
    expect(loader).toBeCalledTimes(1);
    expect(loader).lastCalledWith(init, ['prop']);

    const cache = obj.prop;
    expect(cache).toBe(value);
  });

  it('loads both member', async (): Promise<void> => {
    const init = { id: 1 };
    const obj = lazyLoadObj(init, loader);

    const promise1 = obj.prop;
    expect(promise1).toBeInstanceOf(Promise);

    const promise2 = obj.other;
    expect(promise2).toBeInstanceOf(Promise);

    const [value1, value2] = await Promise.all([promise1, promise2]);
    expect(value1).toBe(2);
    expect((init as Test).prop).toBe(value1); // must modify the init object
    expect(value2).toBe(3);
    expect((init as Test).other).toBe(value2); // must modify the init object
    expect(loader).toBeCalledTimes(1);
    expect(loader).lastCalledWith(init, ['prop', 'other']);

    const { prop: cache1, other: cache2 } = obj;
    expect(cache1).toBe(value1);
    expect(cache2).toBe(value2);
  });

  it('loads alien property if no lazyLoadableProperties', async (): Promise<
    void
  > => {
    const init = { id: 1 };
    const obj = lazyLoadObj(init, loader);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promise = (obj as any).alien;
    expect(promise).toBeInstanceOf(Promise);
    const value = await promise;
    expect(value).toBeUndefined();
    expect(loader).toBeCalledTimes(1);
    expect(loader).lastCalledWith(init, ['alien']);
  });

  it('does NOT load alien property if lazyLoadableProperties', async (): Promise<
    void
  > => {
    const init = { id: 1 };
    const obj = lazyLoadObj(init, loader, ['other', 'prop']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promise = (obj as any).alien;
    expect(promise).toBeUndefined();
    expect(loader).toBeCalledTimes(0);
  });

  it('handles load error (reject)', async (): Promise<void> => {
    const init = { id: 1 };
    const error = new Error('forced error');
    const fn = jest.fn(
      async (): Promise<Test> => {
        throw error;
      },
    );
    const obj = lazyLoadObj(init, fn);
    const promise = obj.prop;
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toThrow(error);
    expect(fn).toBeCalledTimes(1);
    expect(fn).lastCalledWith(init, ['prop']);
  });

  it('handles load error (throw)', async (): Promise<void> => {
    const init = { id: 1 };
    const error = new Error('forced error');
    const fn = jest.fn(
      (): Promise<Test> => {
        throw error;
      },
    );
    const obj = lazyLoadObj(init, fn);
    const promise = obj.prop;
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toThrow(error);
    expect(fn).toBeCalledTimes(1);
    expect(fn).lastCalledWith(init, ['prop']);
  });

  it('handles incorrect load return (undefined)', async (): Promise<void> => {
    const init = { id: 1 };
    const fn = jest.fn();
    const obj = lazyLoadObj<Test>(init, fn);
    const promise = obj.prop;
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toThrow(
      new TypeError('load function must return a promise!'),
    );
    expect(fn).toBeCalledTimes(1);
    expect(fn).lastCalledWith(init, ['prop']);
  });

  it('handles incorrect load return (object)', async (): Promise<void> => {
    const init = { id: 1 };
    const fn = jest.fn((): Partial<Test> => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = lazyLoadObj<Test>(init, fn as any);
    const promise = obj.prop;
    expect(promise).toBeInstanceOf(Promise);
    await expect(promise).rejects.toThrow(
      new TypeError('load function must return a promise!'),
    );
    expect(fn).toBeCalledTimes(1);
    expect(fn).lastCalledWith(init, ['prop']);
  });
});
