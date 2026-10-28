import { Navigate } from "react-router-dom";
import { homePathFor } from "@/config";
import { useAuth } from "@/features/auth/hooks";

export default function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathFor(user?.role)} replace />;
}
