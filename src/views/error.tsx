import { Layout } from "./layout";

export function ErrorPage({
  message = "Something went wrong.",
}: {
  message?: string;
}) {
  return (
    <Layout title="Error">
      <p>{message}</p>

      <p>
        <a href="/">Return to the home page</a>
      </p>
    </Layout>
  );
}