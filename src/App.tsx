import React from 'react';
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

interface LineItem {
  description: string;
  quantity: number;
  price: number;
}

interface InvoiceFormData {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  date: string;
  items: LineItem[];
  taxRate: number;
}

interface SavedInvoice extends Omit<InvoiceFormData, 'date'> {
  subtotal: number;
  tax: number;
  total: number;
  _id: string;
  createdAt: Date;
}

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.number().min(1, "Quantity must be greater than 0"),
  price: z.number().min(0.01, "Price must be greater than 0"),
});

const formSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerAddress: z.string().min(1, "Address is required"),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
  taxRate: z.number().min(0).max(100),
});

type FormValues = z.infer<typeof formSchema>;

const InvoiceGenerator = () => {
  const [invoices, setInvoices] = React.useState<SavedInvoice[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  const generatePDF = async (invoiceData: SavedInvoice) => {
    const pdf = new jsPDF();

    pdf.setFont('helvetica');

    pdf.setFontSize(20);
    pdf.text('Company Name', 20, 20);

    pdf.setFontSize(12);
    pdf.text(`Invoice Number: ${invoiceData._id}`, 20, 40);
    pdf.text(`Date: ${formatDate(invoiceData.createdAt)}`, 20, 50);

    pdf.text('Bill To:', 20, 70);
    pdf.text(`Name: ${invoiceData.customerName}`, 30, 80);
    pdf.text(`Email: ${invoiceData.customerEmail}`, 30, 90);
    pdf.text(`Address: ${invoiceData.customerAddress}`, 30, 100);

    const tableTop = 120;
    const lineHeight = 10;

    pdf.setFont('helvetica', 'bold');
    pdf.text('Description', 20, tableTop);
    pdf.text('Qty', 120, tableTop);
    pdf.text('Price', 150, tableTop);
    pdf.text('Total', 180, tableTop);

    pdf.setFont('helvetica', 'normal');
    let yPos = tableTop + lineHeight;

    invoiceData.items.forEach((item: LineItem) => {
      pdf.text(item.description, 20, yPos);
      pdf.text(item.quantity.toString(), 120, yPos);
      pdf.text(`$${item.price.toFixed(2)}`, 150, yPos);
      pdf.text(`$${(item.quantity * item.price).toFixed(2)}`, 180, yPos);
      yPos += lineHeight;
    });

    const totalsStart = yPos + 10;
    pdf.text('Subtotal:', 150, totalsStart);
    pdf.text(`$${invoiceData.subtotal.toFixed(2)}`, 180, totalsStart);

    pdf.text(`Tax (${invoiceData.taxRate}%):`, 150, totalsStart + lineHeight);
    pdf.text(`$${invoiceData.tax.toFixed(2)}`, 180, totalsStart + lineHeight);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Total:', 150, totalsStart + (lineHeight * 2));
    pdf.text(`$${invoiceData.total.toFixed(2)}`, 180, totalsStart + (lineHeight * 2));

    pdf.save(`invoice-${invoiceData._id}.pdf`);
  };


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerAddress: "",
      items: [
        { description: "", quantity: 1, price: 0 }
      ],
      taxRate: 10,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const calculateSubtotal = (items: FormValues['items']) => {
    return items.reduce((sum, item) =>
      sum + (item.quantity * item.price), 0
    );
  };

  const calculateTax = (subtotal: number, taxRate: number) => {
    return subtotal * (taxRate / 100);
  };

  const onSubmit = async (data: FormValues) => {
    const subtotal = calculateSubtotal(data.items);
    const tax = calculateTax(subtotal, data.taxRate);
    const total = subtotal + tax;

    const invoiceData = {
      ...data,
      subtotal,
      tax,
      total,
    };

    try {
      const url = import.meta.env.VITE_SERVER;
      console.log('url:', url);
      const response = await fetch(`${url}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        throw new Error('Failed to save invoice');
      }

      const savedInvoice = await response.json();
      await generatePDF(savedInvoice);

      alert('Invoice saved and PDF generated successfully!');
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving invoice or generating PDF');
    }

  };

  React.useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const url = import.meta.env.VITE_SERVER; // Ensure this is set
        const response = await fetch(`${url}/api/invoices`);
        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }
        const data = await response.json();
        setInvoices(data);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message); // Access the message property safely
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };
  
    fetchInvoices();
  }, []);


  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Generator</CardTitle>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Customer Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerAddress"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Items</h3>
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={e => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => append({ description: "", quantity: 1, price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${calculateSubtotal(form.watch("items")).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({form.watch("taxRate")}%):</span>
                  <span>
                    ${calculateTax(
                      calculateSubtotal(form.watch("items")),
                      form.watch("taxRate")
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total:</span>
                  <span>
                    ${(calculateSubtotal(form.watch("items")) +
                      calculateTax(
                        calculateSubtotal(form.watch("items")),
                        form.watch("taxRate")
                      )).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button type="submit">Generate PDF</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Display All Invoices */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4">All Invoices</h2>
        {loading ? (
          <p>Loading invoices...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">Invoice #</th>
                <th className="border border-gray-300 px-4 py-2">Date</th>
                <th className="border border-gray-300 px-4 py-2">Customer</th>
                <th className="border border-gray-300 px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice._id}>
                  <td className="border border-gray-300 px-4 py-2">
                    {invoice._id}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {invoice.customerName}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    ${invoice.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default InvoiceGenerator;