import { notFound } from "next/navigation";
import { getProductById } from "@/lib/data/products.server";
import { listBrands } from "@/lib/data/brands.server";
import { updateProductAction } from "@/app/actions/products";
import ProductForm from "@/components/admin/ProductForm";
import PageHeader from "@/components/dashboard/PageHeader";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const boundAction = updateProductAction.bind(null, id);
  const brands = await listBrands();

  return (
    <div>
      <PageHeader eyebrow="Inventory" title="Edit Product" description={product.name} />
      <div className="mt-10">
        <ProductForm product={product} action={boundAction} brands={brands} />
      </div>
    </div>
  );
}
