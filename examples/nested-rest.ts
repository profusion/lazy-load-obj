/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
import process from 'process';
import fetch from 'node-fetch';

import lazyLoadObj, { LazyLoadedObject } from '../lib';

const baseUrl = 'https://jsonplaceholder.typicode.com/';

type User = {
  address: object;
  company: object;
  email: string;
  id: number;
  name: string;
  phone: string;
  username: string;
  website: string;
};

// simple loader, all properties triggers load
const loadUser = async (
  { id }: Partial<User>,
  properties: readonly (keyof User)[],
): Promise<Partial<User>> => {
  console.log(`loading users/${id} properties`, properties);
  const response = await fetch(`${baseUrl}users/${id}`);
  const obj = await response.json();
  console.log(`loaded users/${id}`, obj);
  return obj;
};

type Todo = {
  completed: boolean;
  id: number;
  title: string;
  user: LazyLoadedObject<User> | Promise<LazyLoadedObject<User>>;
};

const todoLoadableProperties: readonly (keyof Todo)[] = [
  'completed',
  'title',
  'user',
] as const;

// complex loader: get the returned `userId` and convert it
// to a lazyLoadObj<User>
const loadTodo = async (
  { id }: Partial<Todo>,
  properties: typeof todoLoadableProperties,
): Promise<Partial<Todo>> => {
  console.log(`loading todos/${id} properties`, properties);
  const response = await fetch(`${baseUrl}todos/${id}`);
  const raw = await response.json();
  console.log(`loaded todos/${id}`, raw);

  const { userId, ...rest } = raw;

  return {
    ...rest,
    user: lazyLoadObj({ id: userId }, loadUser),
  };
};

// create a Todo that is lazy loaded given a specific list of properties
const lazyTodo = lazyLoadObj<Todo>(
  { id: Number(process.argv[2] || 1) },
  loadTodo,
  todoLoadableProperties,
);

console.log('use lazyTodo', lazyTodo);

const { title } = lazyTodo;
console.log('accessing title results in', title);
if (title instanceof Promise) {
  console.log('wait title promise...');
  title.then(
    value => console.log('fetched title', value),
    error => console.error('failed to fetch title', error),
  );
}

const { completed } = lazyTodo;
console.log('accessing completed results in', completed);
if (completed instanceof Promise) {
  console.log('wait completed promise...');
  completed.then(
    value => console.log('fetched completed', value),
    error => console.error('failed to fetch completed', error),
  );
}

// User is itself a lazyLoadObj<User> created at loadTodo()
// then its properties (email, name...) are auto-fetched
const { user } = lazyTodo;
// note that the following `console.log(user)` will trigger
// load of property `Symbol(nodejs.util.inspect.custom)`,
// `Symbol(Symbol.toStringTag)` and the likes since
// there `lazyLoadableProperties: undefined` when
// `user: lazyLoadObj(...)` is called inside
// `loadTodo()`!
console.log('accessing user results in', user);
if (user instanceof Promise) {
  console.log('wait user promise...');
  (user as Promise<LazyLoadedObject<User>>).then(
    (value: LazyLoadedObject<User>): void => {
      console.log('fetched user', value);
      const { email, name } = value;
      if (email instanceof Promise) {
        email.then(x => console.log('user email:', x));
      }
      if (name instanceof Promise) {
        name.then(x => {
          console.log(
            'user name:',
            x,
            // NOTE: direct access is now with actual values
            // no promises are returned since the value is
            // cached!
            '(direct access:',
            (lazyTodo.user as LazyLoadedObject<User>).name,
            ')',
          );
        });
      }
    },
    error => console.error('failed to fetch user', error),
  );
}
