import { useContext } from "react";
import { HeaderMetaContext } from "./HeaderMetaContext";

export const useHeaderMeta = () => {
  const ctx = useContext(HeaderMetaContext);
  if (!ctx) {
    throw new Error("useHeaderMeta must be used within HeaderMetaProvider");
  }
  return ctx;
};
