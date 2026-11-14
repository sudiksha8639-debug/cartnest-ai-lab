import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Star,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductImage } from "./ProductImage";
import { Rating } from "./Rating";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const STATUS_COPY = {
  pending: { label: "Awaiting moderation", className: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
  approved: { label: "Published", className: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Not published", className: "bg-secondary text-muted-foreground border-border", icon: X },
} as const;

export function ProductReviews({ product }: { product: Doc<"products"> }) {
  const { isAuthenticated } = useAuth();
  const summary = useQuery(api.reviews.forProduct, { slug: product.slug });
  const myReviews = useQuery(api.reviews.listMine, isAuthenticated ? {} : "skip");
  const generateUploadUrl = useMutation(api.reviews.generateUploadUrl);
  const createReview = useMutation(api.reviews.create);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const existing = (myReviews ?? []).find(
    (review) => review.product?.slug === product.slug,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!isAuthenticated) {
      setError("Sign in to publish a review.");
      return;
    }
    if (title.trim().length < 3) {
      setError("Give your review a short title.");
      return;
    }
    if (body.trim().length < 10) {
      setError("Tell us a little more — at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      let photoId: Id<"_storage"> | undefined;
      if (photo) {
        if (photo.size > MAX_PHOTO_BYTES) {
          throw new Error("Photos must be 5 MB or smaller.");
        }
        if (!photo.type.startsWith("image/")) {
          throw new Error("Please upload an image file.");
        }
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": photo.type || "application/octet-stream" },
          body: photo,
        });
        if (!response.ok) throw new Error("The photo could not be uploaded. Try again.");
        const payload = (await response.json()) as { storageId: Id<"_storage"> };
        photoId = payload.storageId;
      }

      await createReview({
        productId: product._id,
        rating,
        title,
        body,
        photoId,
      });

      toast.success("Review submitted", {
        description: "It will appear on this page once the store team publishes it.",
      });
      setTitle("");
      setBody("");
      setPhoto(null);
      setRating(5);
      if (fileInput.current) fileInput.current.value = "";
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message.replace(/^Uncaught Error:\s*/, "")
          : "Your review could not be submitted.";
      setError(message);
      toast.error("Could not submit review", { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-16" aria-labelledby="reviews-heading" id="reviews">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">From our customers</p>
          <h2 id="reviews-heading" className="mt-2 text-[26px] font-bold tracking-tight sm:text-[30px]">
            Customer reviews
          </h2>
          {summary && summary.count > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Rating value={summary.average} />
              <span className="text-xs text-muted-foreground">
                Based on {summary.count} published review{summary.count === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No published reviews yet. Share your experience to help other customers.
            </p>
          )}
        </div>
        {isAuthenticated ? (
          <a
            href="#write-review"
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary"
          >
            Write a review
          </a>
        ) : (
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to={`/auth?returnTo=/product/${product.slug}`}>Sign in to review</Link>
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {(summary?.reviews ?? []).map((review) => (
          <article
            key={review._id}
            className="rounded-2xl border border-border/80 bg-card p-5"
            data-testid="customer-review"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {review.authorName
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold">{review.authorName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Verified account · {formatDate(review.createdAt)}
                  </p>
                </div>
              </div>
              <Rating value={review.rating} />
            </div>
            <h3 className="mt-3 text-sm font-bold">{review.title}</h3>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{review.body}</p>
            {review.photoUrl && (
              <div className="mt-3 w-32 overflow-hidden rounded-xl border border-border bg-secondary">
                <ProductImage
                  src={review.photoUrl}
                  alt={`Photo submitted by ${review.authorName}`}
                  className="aspect-square w-full object-cover"
                />
              </div>
            )}
          </article>
        ))}
      </div>

      <div id="write-review" className="mt-6 scroll-mt-32">
        {!isAuthenticated ? (
          <div className="rounded-2xl border border-border/80 bg-[oklch(0.972_0.012_275)] p-5">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 size-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Have this product? Share your experience.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Sign in to post a review and upload a photo. Reviews are published after a quick
                  moderation check.
                </p>
                <Button asChild size="sm" className="mt-3 rounded-full">
                  <Link to={`/auth?returnTo=/product/${product.slug}`}>Sign in to write a review</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : existing ? (
          <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-5" data-testid="review-existing">
            <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">You have already reviewed this product.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Status:{" "}
                <span className="font-semibold text-foreground">
                  {STATUS_COPY[existing.status as keyof typeof STATUS_COPY]?.label ?? existing.status}
                </span>
                . Manage your reviews from your account dashboard.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 rounded-full">
                <Link to="/account?tab=reviews">Go to my reviews</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
            data-testid="review-form"
          >
            <h3 className="text-base font-bold tracking-tight">Write a review</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Reviews are public once approved. Do not include real personal information.
            </p>

            <fieldset className="mt-4">
              <legend className="text-xs font-semibold">Your rating</legend>
              <div className="mt-2 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className="cursor-pointer rounded-full p-0.5"
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  >
                    <input
                      type="radio"
                      name="review_rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                      data-testid={`review-rating-${value}`}
                      className="sr-only"
                    />
                    <Star
                      className={cn(
                        "size-5 transition-colors",
                        value <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-transparent text-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    />
                  </label>
                ))}
                <span className="ml-2 text-xs font-semibold text-foreground">{rating}.0</span>
              </div>
            </fieldset>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="review_title" className="text-xs font-semibold">
                  Review title
                </Label>
                <Input
                  id="review_title"
                  name="review_title"
                  data-testid="review-title"
                  className="mt-1.5"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 90))}
                  placeholder="Excellent sound and build quality"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="review_body" className="text-xs font-semibold">
                  Your review
                </Label>
                <Textarea
                  id="review_body"
                  name="review_body"
                  data-testid="review-body"
                  className="mt-1.5 min-h-28 resize-y"
                  value={body}
                  onChange={(event) => setBody(event.target.value.slice(0, 1500))}
                  placeholder="What did you like or dislike? How was it in daily use?"
                  required
                />
                <p className="mt-1 text-right text-[10px] text-muted-foreground">{body.length}/1500</p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="review_photo" className="text-xs font-semibold">
                  Add a photo <span className="font-normal text-muted-foreground">(optional, up to 5 MB)</span>
                </Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="review_photo"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Camera className="size-4" aria-hidden="true" />
                    {photo ? "Change photo" : "Upload photo"}
                  </label>
                  <input
                    ref={fileInput}
                    id="review_photo"
                    name="review_photo"
                    type="file"
                    accept="image/*"
                    data-testid="review-photo"
                    className="sr-only"
                    onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                  />
                  {photo && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px]">
                      {photo.name}
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          if (fileInput.current) fileInput.current.value = "";
                        }}
                        aria-label="Remove selected photo"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting} data-testid="review-submit" className="rounded-full">
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Submit review
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Published after moderation by the store team.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
