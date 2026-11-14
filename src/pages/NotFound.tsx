import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Compass, Home } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[62vh] flex-col items-center justify-center py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center"
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-accent text-primary">
          <Compass className="size-7" aria-hidden="true" />
        </span>
        <p className="eyebrow mt-5">Error 404</p>
        <h1 className="mt-2 text-[38px] font-bold leading-tight tracking-[-0.03em] sm:text-[48px]">
          We couldn't find that page.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          The page may have moved or the address may be incorrect. Return to the storefront to
          continue where you left off.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild className="rounded-full">
            <Link to="/">
              <Home className="size-4" aria-hidden="true" /> Back home
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/shop">
              <ArrowLeft className="size-4" aria-hidden="true" /> Browse products
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
