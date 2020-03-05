export type LazyLoadedObject<T> = {
  [P in keyof T]: T[P] | Promise<T[P]>;
};

export type LazyLoader<
  FullType extends object,
  InitialType extends Partial<FullType> = Partial<FullType>
> = (
  initial: InitialType,
  properties: readonly (keyof FullType)[],
) => Promise<Partial<FullType>>;

type OnFinishLoadCallback<T> = (
  error: Error | undefined,
  loadedValue: T | undefined,
) => void;

/**
 * Take the initial object, a partial version of the full object that may be
 * loaded, and a load function that receives the existing object and the
 * missing properties, returning the loaded version.
 *
 * This is achieved via Proxy() that provides a `get` handler that checks if the
 * property already exists, returning it immediately, or a promise.
 *
 * During a main loop iteration all fields are batched into one request.
 *
 * @param initial The object to be lazy loaded, it's modified using `Object.assign()`!
 * @param load how to load the required properties
 * @param lazyLoadableProperties if defined, only these values will trigger a lazy
 *        load, others will either return the pre-defined value or `undefined`.
 *        If not undefined, all properties will trigger a lazy load -- watch out
 *        usage with console.log() -> `Symbol(nodejs.util.inspect.custom)` and the
 *        likes!
 */
const lazyLoadObj = <
  FullType extends object,
  InitialType extends Partial<FullType> = Partial<FullType>
>(
  initial: InitialType,
  load: LazyLoader<FullType, InitialType>,
  lazyLoadableProperties?: readonly (keyof FullType)[],
): LazyLoadedObject<FullType> => {
  let pendingLoad: Promise<void> | undefined;
  let propertiesToLoad: Set<keyof FullType> = new Set();
  let onFinishLoad: OnFinishLoadCallback<Partial<FullType>>[] = [];

  const requestLoad = (): void => {
    if (pendingLoad) {
      // batch all properties in a single load, they are stored in
      // `propertiesToLoad`
      return;
    }

    pendingLoad = new Promise(resolve => {
      // do the load on the next main loop iteration, allows other
      // properties to be batched in `propertiesToLoad` + `onFinishLoad`
      setImmediate((): void => {
        // any other `get()` that happens while this is doing the real `load()`
        // should start a new promise, with new `propertiesToLoad` and new
        // `onFinishLoad`
        const properties = Array.from(propertiesToLoad);
        propertiesToLoad = new Set();

        const onFinishLoadCallbacks = onFinishLoad;
        onFinishLoad = [];

        pendingLoad = undefined;

        let promise: unknown;
        try {
          promise = load(initial, properties);
          if (!(promise instanceof Promise)) {
            throw new TypeError('load function must return a promise!');
          }
        } catch (error) {
          onFinishLoadCallbacks.forEach(cb => cb(error, undefined));
          resolve();
          return;
        }

        (promise as Promise<Partial<FullType>>).then(
          (value: Partial<FullType>): void => {
            Object.assign(initial, value);
            onFinishLoadCallbacks.forEach(cb => cb(undefined, value));
            resolve();
          },
          (error: Error): void => {
            onFinishLoadCallbacks.forEach(cb => cb(error, undefined));
            resolve();
          },
        );
      });
    });
  };

  return new Proxy(initial, {
    get(obj, name: keyof FullType): unknown {
      if (name in obj) {
        return obj[name];
      }

      if (lazyLoadableProperties && !lazyLoadableProperties.includes(name)) {
        return undefined;
      }

      propertiesToLoad.add(name);

      // it's okay to call this before `onFinishLoad` is pushed since
      // it will only load on the next main loop iteration due `setImmediate()`
      requestLoad();

      return new Promise((resolve, reject) => {
        onFinishLoad.push(error => {
          if (error) {
            reject(error);
            return;
          }
          // object is already updated using Object.assign()
          resolve(obj[name]);
        });
      });
    },
  }) as LazyLoadedObject<FullType>;
};

export default lazyLoadObj;
