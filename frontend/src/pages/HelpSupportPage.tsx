import { useState } from "react";
import {
  HelpCircle,
  Book,
  MessageCircle,
  Mail,
  Phone,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Shield,
  AlertTriangle,
  CreditCard,
  Users,
  Settings,
  BarChart,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Badge,
} from "@/components/ui";
import { PageTransition } from "@/components/common";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface Resource {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}

const faqData: FAQItem[] = [
  {
    id: "1",
    question: "How does the fraud detection system work?",
    answer:
      "Our fraud detection system uses advanced machine learning algorithms to analyze transaction patterns in real-time. It evaluates multiple factors including transaction amount, location, time, merchant category, and historical behavior to calculate a risk score. Transactions exceeding certain thresholds are automatically flagged for review.",
    category: "fraud-detection",
  },
  {
    id: "2",
    question: "What do the different risk levels mean?",
    answer:
      "Risk levels are categorized as: Low (green) - Normal transaction patterns, no action needed. Medium (yellow) - Some unusual patterns detected, monitored but allowed. High (orange) - Significant anomalies detected, may require manual review. Critical (red) - Strong fraud indicators, transaction may be blocked automatically.",
    category: "fraud-detection",
  },
  {
    id: "3",
    question: "How can I review flagged transactions?",
    answer:
      "Navigate to the Transactions page and use the filters to show only flagged transactions. You can click on any transaction to view detailed information including the risk factors that triggered the flag. From there, you can mark transactions as legitimate or confirm fraud.",
    category: "transactions",
  },
  {
    id: "4",
    question: "Can I customize the fraud detection rules?",
    answer:
      "Yes, administrators can customize detection rules through the Risk Analysis page. You can adjust thresholds for different risk factors, create custom rules based on your business needs, and configure alerts for specific patterns.",
    category: "fraud-detection",
  },
  {
    id: "5",
    question: "How do I export transaction reports?",
    answer:
      "On the Transactions page, use the export button in the top right corner. You can export data in CSV or PDF format. Apply filters first to export specific date ranges or transaction types.",
    category: "transactions",
  },
  {
    id: "6",
    question: "What user roles are available?",
    answer:
      "The system supports three main roles: Analyst - Can view the review queue, add notes and propose a decision, but cannot move money. Reviewer - Can approve, void or refund held payments up to a decision limit. Admin - Everything: payments of any size, users, roles, limits, rules and the audit log.",
    category: "users",
  },
  {
    id: "7",
    question: "How do I add a new team member?",
    answer:
      "Admins can add new users through Admin > Users. Click 'Add User', enter their email and assign a role. They will receive an invitation email to set up their account.",
    category: "users",
  },
  {
    id: "8",
    question: "What should I do if I see a suspicious pattern?",
    answer:
      "If you identify a suspicious pattern, you can: 1) Flag individual transactions for review, 2) Create a custom alert rule to monitor similar patterns, 3) Generate a report for your security team, 4) Contact support if you need assistance with investigation.",
    category: "fraud-detection",
  },
  {
    id: "9",
    question: "How often is the dashboard data updated?",
    answer:
      "Dashboard statistics are updated in real-time for critical metrics. Aggregated reports and charts refresh every 5 minutes. You can manually refresh the page to see the latest data.",
    category: "general",
  },
  {
    id: "10",
    question: "How can I change my password or account settings?",
    answer:
      "Go to Settings > Preferences to update your account details. For password changes, click on your profile avatar in the top right and select 'Change Password'. Two-factor authentication can also be enabled from this menu.",
    category: "general",
  },
];

const resources: Resource[] = [
  {
    title: "Documentation",
    description: "Comprehensive guides and API documentation",
    icon: Book,
    href: "#",
    badge: "Updated",
  },
  {
    title: "Video Tutorials",
    description: "Step-by-step video guides for common tasks",
    icon: FileText,
    href: "#",
  },
  {
    title: "API Reference",
    description: "Technical documentation for integrations",
    icon: FileText,
    href: "#",
  },
  {
    title: "Best Practices",
    description: "Tips for effective fraud prevention",
    icon: Shield,
    href: "#",
  },
];

const categoryIcons: Record<string, React.ElementType> = {
  "fraud-detection": Shield,
  transactions: CreditCard,
  users: Users,
  general: Settings,
};

const categoryLabels: Record<string, string> = {
  "fraud-detection": "Fraud Detection",
  transactions: "Transactions",
  users: "User Management",
  general: "General",
};

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const CategoryIcon = categoryIcons[item.category] || HelpCircle;

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <CategoryIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {item.question}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-neutral-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-neutral-500 flex-shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 pt-0">
              <div className="pl-11">
                <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {item.answer}
                </p>
                <Badge variant="outline" className="mt-3">
                  {categoryLabels[item.category]}
                </Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HelpSupportPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Topics", icon: HelpCircle },
    { id: "fraud-detection", label: "Fraud Detection", icon: Shield },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "users", label: "User Management", icon: Users },
    { id: "general", label: "General", icon: Settings },
  ];

  const filteredFAQs = faqData.filter((faq) => {
    const matchesSearch =
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleFAQ = (id: string) => {
    setOpenFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Help & Support
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Find answers, resources, and get help with the fraud detection
            platform
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Live Chat
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Chat with our support team
                  </p>
                  <Badge variant="success" className="mt-2">
                    Online
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg">
                  <Mail className="h-6 w-6 text-secondary-600 dark:text-secondary-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Email Support
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    support@fraudshield.com
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                    Response within 24 hours
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-accent-100 dark:bg-accent-900/30 rounded-lg">
                  <Phone className="h-6 w-6 text-accent-600 dark:text-accent-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Phone Support
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    +1 (800) 123-4567
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                    Mon-Fri, 9am-6pm EST
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>
              Search our knowledge base or browse by category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search for answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    key={category.id}
                    variant={
                      selectedCategory === category.id ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {category.label}
                  </Button>
                );
              })}
            </div>

            {/* FAQ List */}
            <div className="space-y-3">
              {filteredFAQs.length > 0 ? (
                filteredFAQs.map((faq) => (
                  <FAQAccordionItem
                    key={faq.id}
                    item={faq}
                    isOpen={openFAQs.has(faq.id)}
                    onToggle={() => toggleFAQ(faq.id)}
                  />
                ))
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-neutral-500 dark:text-neutral-400">
                    No results found for "{searchQuery}"
                  </p>
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1">
                    Try different keywords or browse by category
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resources Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Resources & Documentation
            </CardTitle>
            <CardDescription>
              Explore guides, tutorials, and documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resources.map((resource) => {
                const Icon = resource.icon;
                return (
                  <a
                    key={resource.title}
                    href={resource.href}
                    className="flex items-start gap-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                  >
                    <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                      <Icon className="h-5 w-5 text-neutral-600 dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                          {resource.title}
                        </h4>
                        {resource.badge && (
                          <Badge variant="info" className="text-xs">
                            {resource.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                        {resource.description}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Current operational status of FraudShield services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "API Services", status: "operational" },
                { name: "Real-time Detection", status: "operational" },
                { name: "Dashboard & Analytics", status: "operational" },
                { name: "Notification Service", status: "operational" },
              ].map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {service.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        service.status === "operational"
                          ? "bg-success-500"
                          : service.status === "degraded"
                            ? "bg-warning-500"
                            : "bg-danger-500"
                      }`}
                    />
                    <span
                      className={`text-sm capitalize ${
                        service.status === "operational"
                          ? "text-success-600 dark:text-success-400"
                          : service.status === "degraded"
                            ? "text-warning-600 dark:text-warning-400"
                            : "text-danger-600 dark:text-danger-400"
                      }`}
                    >
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Last updated: {new Date().toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Submit a Support Request
            </CardTitle>
            <CardDescription>
              Can't find what you're looking for? Send us a message
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                // Handle form submission
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="subject"
                    className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Subject
                  </label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="priority"
                    className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Priority
                  </label>
                  <select
                    id="priority"
                    className="w-full h-10 px-3 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="low">Low - General question</option>
                    <option value="medium">Medium - Need help soon</option>
                    <option value="high">High - Urgent issue</option>
                    <option value="critical">Critical - System down</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="message"
                  className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  placeholder="Describe your issue or question in detail..."
                  className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">
                  <Mail className="h-4 w-4 mr-2" />
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
