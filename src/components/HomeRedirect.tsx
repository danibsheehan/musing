import { Navigate } from "react-router-dom";
import { useWorkspace } from "../context/useWorkspace";

export default function HomeRedirect() {
  const { resolveOpenPageId } = useWorkspace();
  return <Navigate to={`/page/${resolveOpenPageId()}`} replace />;
}
