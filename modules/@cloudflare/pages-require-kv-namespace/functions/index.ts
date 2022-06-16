export const onRequest = () => {
  return new Response(
    `<html>
  <body>
    <h4>Bind a KV namespace</h4>
    <form>
      <div>
        <select>
          <option>Select an existing KV namespace</option>
          <option>a</option>
          <option>b</option>
        </select>
      </div>
      <div>
        <label>
          Create a new namespace
          <input type="text" />
        </label>
      </div>
      <div>
        <button type="submit">Submit</button>
      </div>
    </form>
  </body>
  </html>`,
    { headers: { "Content-Type": "text/html" } }
  );
};
