import { notFound } from "next/navigation";
import { getProductById } from "@/lib/data/products.server";
import { updateProductAction } from "@/app/actions/products";
import ProductForm from "@/components/admin/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) notFound();

  const boundAction = updateProductAction.bind(null, id);

  return (
    <div>
      <h1 className="font-display text-2xl text-ivory">Edit Product</h1>
      <div className="mt-6">
        <ProductForm product={product} action={boundAction} />
      </div>
    </div>
  );
}
