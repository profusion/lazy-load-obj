# Lazy Load Object Fields

Simple [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
that coordinates loading fields of an object on demand.

This is useful to be matched with GraphQL, where one can return a
shallow object (ie: `{ id }`) and let the properties be loaded in one
go once used.

## Example

See [examples/](./examples/).

```typescript
/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
import process from 'process';
import fetch from 'node-fetch';

import lazyLoadObj from '../lib';

const baseUrl = 'https://jsonplaceholder.typicode.com/';

type Todo = {
  completed: boolean;
  id: number;
  title: string;
};

const lazyTodo = lazyLoadObj<Todo>(
  { id: Number(process.argv[2] || 1) },
  async (
    { id }: Partial<Todo>,
    properties: readonly (keyof Todo)[],
  ): Promise<Partial<Todo>> => {
    console.log(`loading todos/${id} properties`, properties);
    const response = await fetch(`${baseUrl}todos/${id}`);
    return response.json();
  },
);

const { title } = lazyTodo;
console.log('accessing title results in', title);
if (title instanceof Promise) {
  console.log('wait title promise...');
  title.then(
    value => {
      console.log('fetched title', value);
      // the next access will always return a value, since it's cached:
      console.log('access cached title', lazyTodo.title);
    },
    error => console.error('failed to fetch title', error),
  );
}
```
