import { NextPage } from "next"

const ErrorPage: NextPage<{ statusCode?: number }> = ({ statusCode }) => {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold" }}>{statusCode || "Error"}</h1>
        <p style={{ marginTop: "0.5rem", color: "#666" }}>
          {statusCode === 404 ? "Page not found" : "Something went wrong"}
        </p>
      </div>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default ErrorPage
