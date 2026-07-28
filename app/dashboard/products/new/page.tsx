import ProductForm from "@/components/admin/ProductForm";
import PageHeader from "@/components/dashboard/PageHeader";
import { createProductAction } from "@/app/actions/products";
import { listBrands } from "@/lib/data/brands.server";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader eyebrow="Inventory" title="Add Product" />
      <div className="mt-10">
        <ProductForm action={createProductAction} brands={listBrands()} />
      </div>
    </div>
  );
}
